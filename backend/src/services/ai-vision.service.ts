import { createHash } from 'crypto';
import { GoogleGenAI, Type } from '@google/genai';
import { env, getCacheTtlMs, getGeminiModel, isProductionEnv } from '../config/env';
import { AppError, ServiceBusyError } from '../utils/errors.util';
import {
  aiConcurrencyQueue,
  extractUpstreamErrorDetails,
  FallbackReason,
  isRetryableStatus,
  logServiceAttempt,
  TtlCache,
  UpstreamServiceError,
  withRetryWithBackoff,
} from '../utils/resilience.util';

export type { FallbackReason };

export interface MusicPreferences {
  genres?: string;
  language?: string;
  era?: string;
}

export interface AiTrackSuggestion {
  title: string;
  artist: string;
  reason: string;
  forceAttenuatedPreview?: boolean;
}

export interface AiVisionResult {
  vibeSummary: string;
  moodTags: string[];
  dominantColors: string[];
  tracks: AiTrackSuggestion[];
  isFallback: boolean;
  fallbackReason?: FallbackReason;
  upstreamStatus?: number;
  cacheHash?: string;
  fromCache?: boolean;
}

interface CuratedProfile {
  dominantColors: string[];
  tracks: Array<{ title: string; artist: string }>;
}

const visionCache = new TtlCache<AiVisionResult>();

export function clearAiVisionCache(): void {
  visionCache.clear();
}

export const FALLBACK_VIBE_SUMMARY =
  'Sugestões populares enquanto a análise da sua foto não está disponível.';

export const FALLBACK_TRACK_REASON =
  'Sugestão popular selecionada enquanto a análise visual da foto não está disponível.';

const CURATED_PROFILES: CuratedProfile[] = [
  {
    dominantColors: ['#F59E0B', '#EC4899', '#1E1B4B'],
    tracks: [
      { title: 'Sunflower', artist: 'Post Malone & Swae Lee' },
      { title: 'Midnight City', artist: 'M83' },
      { title: 'Trem-Bala', artist: 'Ana Vilela' },
      { title: 'Golden Hour', artist: 'JVKE' },
    ],
  },
  {
    dominantColors: ['#6366F1', '#06B6D4', '#0F172A'],
    tracks: [
      { title: 'Blinding Lights', artist: 'The Weeknd' },
      { title: 'Levitating', artist: 'Dua Lipa' },
      { title: 'Starboy', artist: 'The Weeknd' },
      { title: 'Do I Wanna Know?', artist: 'Arctic Monkeys' },
    ],
  },
  {
    dominantColors: ['#10B981', '#14B8A6', '#111827'],
    tracks: [
      { title: 'Put Your Records On', artist: 'Corinne Bailey Rae' },
      { title: 'Yellow', artist: 'Coldplay' },
      { title: 'Velha Infância', artist: 'Tribalistas' },
      { title: 'Come Away With Me', artist: 'Norah Jones' },
    ],
  },
];

export type Simulate429Mode =
  | 'none'
  | 'retry_then_succeed'
  | 'always_429_ai'
  | 'always_429_music';

/**
 * Desativa completamente qualquer simulação quando NODE_ENV === 'production'.
 * Fora de produção, exige os tokens explícitos de simulação.
 */
export function resolveSimulationMode(
  preferences?: MusicPreferences,
  explicitMode?: string
): Simulate429Mode {
  if (isProductionEnv()) {
    return 'none';
  }

  const candidates = [
    explicitMode,
    preferences?.genres,
    process.env.SIMULATE_429_MODE,
    env.SIMULATE_429_MODE,
  ]
    .filter(Boolean)
    .map((s) => String(s).trim().toLowerCase());

  for (const val of candidates) {
    if (val.includes('simulate_429_retry') || val === 'retry_then_succeed' || val === 'retry') {
      return 'retry_then_succeed';
    }
    if (
      val.includes('simulate_429_busy') ||
      val.includes('simulate_429_ai') ||
      val === 'always_429_ai' ||
      val === 'busy'
    ) {
      return 'always_429_ai';
    }
    if (
      val.includes('simulate_429_music') ||
      val === 'always_429_music' ||
      val === 'music_fallback' ||
      val === 'music'
    ) {
      return 'always_429_music';
    }
  }

  return 'none';
}

class InvalidAiResponseError extends Error {
  public readonly rawResponseText: string;

  constructor(message: string, rawResponseText: string) {
    super(message);
    this.rawResponseText = rawResponseText.slice(0, 500);
    Object.setPrototypeOf(this, InvalidAiResponseError.prototype);
  }
}

export class AiVisionService {
  /**
   * Valida o nome do modelo configurado em GEMINI_MODEL na inicialização do servidor.
   * Se a chamada falhar com 404 (modelo inexistente ou indisponível para a chave), registra erro claro.
   */
  public async validateModelOnStartup(): Promise<boolean> {
    const apiKey = (process.env.GEMINI_API_KEY ?? env.GEMINI_API_KEY ?? '').trim();
    const modelName = getGeminiModel();

    if (!apiKey || apiKey.length < 10) {
      console.warn(
        JSON.stringify({
          level: 'warn',
          event: 'gemini_startup_check',
          model: modelName,
          message:
            'GEMINI_API_KEY ausente ou vazia na inicialização. O sistema operará em modo fallback (NO_API_KEY) até que uma chave válida seja configurada.',
        })
      );
      return false;
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      await ai.models.generateContent({
        model: modelName,
        contents: 'OK',
        config: { maxOutputTokens: 5 },
      });
      console.info(
        JSON.stringify({
          level: 'info',
          event: 'gemini_startup_check',
          model: modelName,
          status: 200,
          message: `Modelo Gemini '${modelName}' validado com sucesso na inicialização.`,
        })
      );
      return true;
    } catch (err) {
      const details = extractUpstreamErrorDetails(err, 'AI_VISION');
      console.error(
        JSON.stringify({
          level: 'error',
          event: 'gemini_model_validation_failed',
          model: modelName,
          status: details.status,
          errorBody: details.errorBody,
          message:
            details.status === 404
              ? `ERRO DE CONFIGURAÇÃO: O modelo '${modelName}' (GEMINI_MODEL) retornou 404 NOT_FOUND e não está disponível para sua chave.`
              : `Falha ao validar modelo '${modelName}' na inicialização (status ${details.status}).`,
        })
      );
      return false;
    }
  }

  /**
   * Gera um hash determinístico (SHA-256) combinando os bytes da imagem + filtros escolhidos + faixas excluídas.
   */
  public computeAnalysisHash(
    rawBase64: string,
    preferences?: MusicPreferences,
    excludedTrackTitles: string[] = []
  ): string {
    const normalizedPrefs = {
      genres: preferences?.genres?.trim().toLowerCase() || '',
      language: preferences?.language?.trim().toLowerCase() || '',
      era: preferences?.era?.trim().toLowerCase() || '',
    };
    const normalizedExclusions = excludedTrackTitles
      .map((t) => t.trim().toLowerCase())
      .sort()
      .join('|');

    return createHash('sha256')
      .update(rawBase64)
      .update('::')
      .update(JSON.stringify(normalizedPrefs))
      .update('::')
      .update(normalizedExclusions)
      .digest('hex');
  }

  /**
   * Valida se o payload representa uma imagem DataURL/Base64 suportada e íntegra (RF-002 / RT-002).
   * Desativa gatilhos de simulação quando NODE_ENV === 'production'.
   */
  public parseAndValidateImage(imageBase64: string): { mimeType: string; rawBase64: string } {
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      throw new AppError(
        'Nenhuma imagem foi enviada. Selecione uma fotografia válida (JPEG, PNG ou WebP).',
        400,
        'INVALID_IMAGE_PAYLOAD'
      );
    }

    const trimmed = imageBase64.trim();
    const isProd = isProductionEnv();

    if (!isProd && trimmed.includes('SIMULATE_AI_FAILURE')) {
      throw new AppError(
        'Serviço de análise visual temporariamente indisponível. Tente novamente em instantes.',
        502,
        'AI_SERVICE_UNAVAILABLE'
      );
    }

    if ((!isProd && trimmed.includes('CORRUPTED_IMAGE')) || trimmed.length < 30) {
      throw new AppError(
        'O arquivo enviado está corrompido ou ilegível. Escolha outra fotografia.',
        422,
        'UNPROCESSABLE_IMAGE'
      );
    }

    const dataUrlMatch = trimmed.match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,(.+)$/i);
    if (!dataUrlMatch) {
      throw new AppError(
        'Formato de arquivo não suportado. Envie apenas imagens nos formatos JPEG, PNG ou WebP.',
        422,
        'UNSUPPORTED_IMAGE_FORMAT'
      );
    }

    const mimeType =
      dataUrlMatch[1].toLowerCase() === 'image/jpg'
        ? 'image/jpeg'
        : dataUrlMatch[1].toLowerCase();
    const rawBase64 = dataUrlMatch[2].trim();

    if (rawBase64.length < 16) {
      throw new AppError(
        'Os dados da imagem enviada são inválidos ou estão vazios.',
        422,
        'EMPTY_IMAGE_DATA'
      );
    }

    return { mimeType, rawBase64 };
  }

  async analyzePhoto(
    imageBase64: string,
    preferences?: MusicPreferences,
    excludedTrackTitles: string[] = [],
    simulateMode?: string,
    options?: { bypassCache?: boolean }
  ): Promise<AiVisionResult> {
    const { mimeType, rawBase64 } = this.parseAndValidateImage(imageBase64);
    const activeSimMode = resolveSimulationMode(preferences, simulateMode);

    const cacheHash = this.computeAnalysisHash(rawBase64, preferences, excludedTrackTitles);
    const ttlMs = getCacheTtlMs();

    // Só lê do cache se não for simulação, se não pediu bypassCache e se o item cacheado NÃO for fallback
    if (activeSimMode === 'none' && !options?.bypassCache) {
      const cached = visionCache.get(cacheHash);
      if (cached && !cached.isFallback) {
        return {
          ...cached,
          cacheHash,
          fromCache: true,
        };
      }
    }

    const apiKey = (
      process.env.GEMINI_API_KEY !== undefined
        ? process.env.GEMINI_API_KEY
        : env.GEMINI_API_KEY
    ).trim();

    // 1. Verifica se a chave está presente (sem bloquear chaves válidas que começam com "AQ." ou "AIza")
    if (activeSimMode === 'none' && (!apiKey || apiKey.length < 10)) {
      logServiceAttempt({
        service: 'AI_VISION',
        attempt: 1,
        maxAttempts: 1,
        status: 401,
        waitMs: 0,
        fallbackReason: 'NO_API_KEY',
        errorBody: 'GEMINI_API_KEY ausente, vazia ou com menos de 10 caracteres.',
        outcome: 'FALLBACK',
      });

      return this.buildFallbackResult({
        rawBase64,
        excludedTrackTitles,
        cacheHash,
        fallbackReason: 'NO_API_KEY',
        upstreamStatus: 401,
      });
    }

    const modelName = getGeminiModel();

    try {
      const realAiResult = await aiConcurrencyQueue.run(async () => {
        return withRetryWithBackoff(
          {
            service: 'AI_VISION',
          },
          async (attempt) => {
            if (activeSimMode === 'always_429_ai') {
              throw new UpstreamServiceError({
                service: 'AI_VISION',
                status: 429,
                retryAfterHeader: '1',
                message: 'Simulated 429 Too Many Requests from AI service (Always Busy)',
                errorBody: JSON.stringify({
                  error: {
                    code: 429,
                    status: 'RESOURCE_EXHAUSTED',
                    message:
                      'Quota exceeded for metric generativelanguage.googleapis.com/generate_content_requests',
                  },
                }),
              });
            }

            if (activeSimMode === 'retry_then_succeed' && attempt <= 2) {
              throw new UpstreamServiceError({
                service: 'AI_VISION',
                status: 429,
                retryAfterHeader: '1',
                message: `Simulated transient 429 Too Many Requests on attempt ${attempt}`,
                errorBody: JSON.stringify({
                  error: {
                    code: 429,
                    status: 'RESOURCE_EXHAUSTED',
                    message: `Transient rate limit on attempt ${attempt}, retry-after 1s`,
                  },
                }),
              });
            }

            const ai = new GoogleGenAI({ apiKey });
            const cleanGenres = isProductionEnv()
              ? preferences?.genres?.trim()
              : preferences?.genres?.replace(/simulate_429_[a-z_]+/gi, '').trim();

            const prefDescription = [
              cleanGenres ? `Gêneros preferidos: ${cleanGenres}` : null,
              preferences?.language ? `Idioma preferido: ${preferences.language}` : null,
              preferences?.era ? `Época/Década preferida: ${preferences.era}` : null,
            ]
              .filter(Boolean)
              .join(' | ');

            const exclusionNote =
              excludedTrackTitles.length > 0
                ? `NÃO repita nenhuma destas músicas já sugeridas anteriormente para esta foto: ${excludedTrackTitles.join(', ')}.`
                : '';

            const prompt = `Você é um curador musical especialista do aplicativo VibeTrack.
Analise a fotografia enviada e identifique especificamente o cenário, objetos, cores, iluminação, clima e emoção presentes nesta imagem única.
Em seguida, recomende entre 3 e 5 músicas reais e conhecidas que combinem especificamente com o que aparece nesta fotografia (evite repetir sempre os mesmos clichês como Sunflower, Midnight City, Blinding Lights ou Yellow, a menos que a imagem realmente peça).
${prefDescription ? `Direcionamento opcional do usuário: ${prefDescription}.` : ''}
${exclusionNote}
Responda estritamente em Português do Brasil no formato JSON especificado.`;

            let responseText = '';
            try {
              const response = await ai.models.generateContent({
                model: modelName,
                contents: [
                  {
                    role: 'user',
                    parts: [
                      { text: prompt },
                      {
                        inlineData: {
                          mimeType,
                          data: rawBase64,
                        },
                      },
                    ],
                  },
                ],
                config: {
                  responseMimeType: 'application/json',
                  responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                      vibeSummary: {
                        type: Type.STRING,
                        description:
                          'Síntese em português do clima, emoção e contexto visual da foto.',
                      },
                      moodTags: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                        description: 'De 3 a 5 palavras-chave curtas descrevendo o clima da foto.',
                      },
                      dominantColors: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                        description:
                          '3 códigos hexadecimais (#RRGGBB) que representam a paleta da foto.',
                      },
                      tracks: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            title: { type: Type.STRING },
                            artist: { type: Type.STRING },
                            reason: {
                              type: Type.STRING,
                              description:
                                'Explicação detalhada em português de por que a música combina com a foto.',
                            },
                          },
                          required: ['title', 'artist', 'reason'],
                        },
                      },
                    },
                    required: ['vibeSummary', 'moodTags', 'dominantColors', 'tracks'],
                  },
                },
              });

              responseText = (response.text || '').trim();
            } catch (err) {
              const details = extractUpstreamErrorDetails(err, 'AI_VISION');
              throw new UpstreamServiceError({
                service: 'AI_VISION',
                status: details.status,
                retryAfterHeader: details.retryAfterHeader,
                message: `Falha na API Gemini (${modelName}) status ${details.status}`,
                errorBody: details.errorBody,
              });
            }

            let parsed: Partial<AiVisionResult>;
            try {
              parsed = JSON.parse(responseText || '{}') as Partial<AiVisionResult>;
            } catch {
              throw new InvalidAiResponseError(
                'Falha no JSON.parse da resposta do Gemini',
                responseText
              );
            }

            const validTracks = Array.isArray(parsed.tracks)
              ? parsed.tracks.filter(
                  (t) =>
                    Boolean(t?.title?.trim()) &&
                    Boolean(t?.artist?.trim()) &&
                    Boolean(t?.reason?.trim())
                )
              : [];

            if (!parsed.vibeSummary?.trim() || validTracks.length < 3) {
              throw new InvalidAiResponseError(
                `Resposta do Gemini incompleta (tracks=${validTracks.length})`,
                responseText
              );
            }

            return {
              vibeSummary: parsed.vibeSummary.trim(),
              moodTags:
                Array.isArray(parsed.moodTags) && parsed.moodTags.length > 0
                  ? parsed.moodTags.slice(0, 5)
                  : ['Vibe', 'Música', 'Fotografia'],
              dominantColors:
                Array.isArray(parsed.dominantColors) && parsed.dominantColors.length >= 2
                  ? parsed.dominantColors.slice(0, 3)
                  : ['#B91C1C', '#F59E0B', '#141413'],
              tracks: validTracks.slice(0, 5),
              isFallback: false,
              cacheHash,
              fromCache: false,
            } satisfies AiVisionResult;
          }
        );
      });

      // Só armazena no visionCache quando for resposta REAL da IA (isFallback === false)
      if (!realAiResult.isFallback && activeSimMode === 'none') {
        visionCache.set(cacheHash, realAiResult, ttlMs);
      }

      return realAiResult;
    } catch (err) {
      if (err instanceof InvalidAiResponseError) {
        logServiceAttempt({
          service: 'AI_VISION',
          attempt: 1,
          maxAttempts: 1,
          status: 200,
          waitMs: 0,
          fallbackReason: 'INVALID_AI_RESPONSE',
          errorBody: `${err.message} | response.text=${err.rawResponseText}`,
          outcome: 'FALLBACK',
        });

        return this.buildFallbackResult({
          rawBase64,
          excludedTrackTitles,
          cacheHash,
          fallbackReason: 'INVALID_AI_RESPONSE',
          upstreamStatus: 200,
        });
      }

      if (err instanceof ServiceBusyError) {
        logServiceAttempt({
          service: 'AI_VISION',
          attempt: 1,
          maxAttempts: 1,
          status: 429,
          waitMs: 0,
          fallbackReason: 'RATE_LIMITED',
          errorBody: err.message,
          outcome: 'FALLBACK',
        });

        return this.buildFallbackResult({
          rawBase64,
          excludedTrackTitles,
          cacheHash,
          fallbackReason: 'RATE_LIMITED',
          upstreamStatus: 429,
        });
      }

      const details = extractUpstreamErrorDetails(err, 'AI_VISION');
      const isInvalidKeyError =
        details.status === 401 ||
        details.status === 403 ||
        /API_KEY_INVALID|key not valid|PERMISSION_DENIED|UNAUTHENTICATED/i.test(details.errorBody);

      const fallbackReason: FallbackReason =
        details.status === 429
          ? 'RATE_LIMITED'
          : isInvalidKeyError
          ? 'NO_API_KEY'
          : 'UPSTREAM_ERROR';

      logServiceAttempt({
        service: 'AI_VISION',
        attempt: 1,
        maxAttempts: 1,
        status: details.status,
        waitMs: 0,
        retryAfterHeader: details.retryAfterHeader,
        fallbackReason,
        errorBody: details.errorBody,
        outcome: 'FALLBACK',
      });

      return this.buildFallbackResult({
        rawBase64,
        excludedTrackTitles,
        cacheHash,
        fallbackReason,
        upstreamStatus: details.status,
      });
    }
  }

  /**
   * Constrói o resultado de fallback com texto estritamente neutro (sem simular leitura da foto)
   * e usando o hash SHA-256 completo da imagem. NUNCA é salvo no cache.
   */
  private buildFallbackResult(params: {
    rawBase64: string;
    excludedTrackTitles: string[];
    cacheHash: string;
    fallbackReason: FallbackReason;
    upstreamStatus?: number;
  }): AiVisionResult {
    const fullDigest = createHash('sha256').update(params.rawBase64).digest();
    const hashInt = fullDigest.readUInt32BE(0) + params.excludedTrackTitles.length * 17;

    const baseProfile = CURATED_PROFILES[hashInt % CURATED_PROFILES.length];
    const excludedLower = new Set(params.excludedTrackTitles.map((t) => t.toLowerCase().trim()));

    const allCandidateTracks = [
      ...baseProfile.tracks,
      ...CURATED_PROFILES.flatMap((p) => p.tracks),
    ].filter((t) => !excludedLower.has(t.title.toLowerCase().trim()));

    const uniqueTracks: AiTrackSuggestion[] = [];
    const seen = new Set<string>();
    for (const track of allCandidateTracks) {
      const key = `${track.title.toLowerCase()}|${track.artist.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueTracks.push({
          title: track.title,
          artist: track.artist,
          reason: FALLBACK_TRACK_REASON,
        });
      }
      if (uniqueTracks.length >= 4) break;
    }

    return {
      vibeSummary: FALLBACK_VIBE_SUMMARY,
      moodTags: ['Sugestões Populares', 'Modo Fallback'],
      dominantColors: baseProfile.dominantColors,
      tracks: uniqueTracks.slice(0, 4),
      isFallback: true,
      fallbackReason: params.fallbackReason,
      upstreamStatus: params.upstreamStatus,
      cacheHash: params.cacheHash,
      fromCache: false,
    };
  }
}

export const aiVisionService = new AiVisionService();
