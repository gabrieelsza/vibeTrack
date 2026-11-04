import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import { CheckerDivider } from '../components/Poster/CheckerDivider';
import { MusicalLoadingStage } from '../components/Poster/MusicalLoadingStage';
import { PolaroidPhoto } from '../components/Poster/PolaroidPhoto';
import { PrimaryPillButton } from '../components/Poster/PrimaryPillButton';
import { TitleHero } from '../components/Poster/TitleHero';
import { TopTrackCard } from '../components/Poster/TopTrackCard';
import { TrackListItem } from '../components/Poster/TrackListItem';
import { ShareCardModal } from '../components/Share/ShareCardModal';
import { useAudioPlayer } from '../contexts/AudioPlayerContext';
import { useAuth } from '../contexts/AuthContext';
import { useNetwork } from '../contexts/NetworkContext';
import { ApiRequestError, apiService } from '../services/api.service';
import {
  CompressedPhotoResult,
  computePhotoAndFilterHash,
  generateSampleDemoPhoto,
  getCachedAnalysisByHash,
  setCachedAnalysisByHash,
  validateAndCompressPhoto,
} from '../services/image-compressor.service';
import { offlineCacheService } from '../services/offline-cache.service';
import { FallbackReason, MusicRecommendation, PhotoAnalysis } from '../types';
import { formatPolaroidCaption } from '../utils/poster.utils';

const GENRE_CHIPS = ['Indie Pop', 'MPB', 'Rock 90s', 'Lo-Fi', 'Synthwave', 'Samba / Bossa'];
const LANGUAGE_CHIPS = ['Português', 'Inglês', 'Espanhol', 'Instrumental'];
const ERA_CHIPS = ['Anos 70', 'Anos 80/90', 'Anos 2000', 'Atuais'];

const BUTTON_DEBOUNCE_MS = Number(import.meta.env.VITE_BUTTON_DEBOUNCE_MS || 800);
const MIN_LOADING_DURATION_MS = Number(import.meta.env.VITE_MIN_LOADING_MS || 3000);

function waitAbortable(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = window.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    const onAbort = () => {
      window.clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

async function ensureMinimumLoadingTime(startTime: number, signal?: AbortSignal): Promise<void> {
  const elapsed = Date.now() - startTime;
  const remaining = MIN_LOADING_DURATION_MS - elapsed;
  if (remaining > 0) {
    await waitAbortable(remaining, signal);
  }
}

function isAbortError(err: unknown): boolean {
  return (
    (err instanceof DOMException && err.name === 'AbortError') ||
    (err instanceof Error && err.name === 'AbortError')
  );
}

export function getFallbackReasonMessage(reason?: FallbackReason): string {
  switch (reason) {
    case 'RATE_LIMITED':
      return 'Muitas pessoas estão usando agora. Tente de novo em alguns segundos.';
    case 'INVALID_AI_RESPONSE':
      return 'A análise não retornou um resultado válido.';
    case 'NO_API_KEY':
    case 'UPSTREAM_ERROR':
    default:
      return 'O serviço de análise está indisponível no momento.';
  }
}

export const HomeAnalysisPage: React.FC = () => {
  const { user } = useAuth();
  const { isOnline } = useNetwork();
  const { stopAll } = useAudioPlayer();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const lastSubmitTimestampRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [selectedPhoto, setSelectedPhoto] = useState<CompressedPhotoResult | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [genres, setGenres] = useState<string>('');
  const [language, setLanguage] = useState<string>('');
  const [era, setEra] = useState<string>('');
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [showVibeNote, setShowVibeNote] = useState<boolean>(false);

  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [regenerating, setRegenerating] = useState<boolean>(false);
  const [isRetrying429, setIsRetrying429] = useState<boolean>(false);
  const [retryCountdownSeconds, setRetryCountdownSeconds] = useState<number | null>(null);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isBusyError, setIsBusyError] = useState<boolean>(false);
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);

  const [currentAnalysis, setCurrentAnalysis] = useState<PhotoAnalysis | null>(null);
  const [shareTarget, setShareTarget] = useState<MusicRecommendation | null>(null);

  const abortActiveRequest = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setAnalyzing(false);
    setRegenerating(false);
    setIsRetrying429(false);
    setRetryCountdownSeconds(null);
  };

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Contador regressivo do botão "TENTAR DE NOVO" durante cooldown após erro 429/503 BUSY
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setCooldownSeconds((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldownSeconds]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Cancela requisição anterior caso o usuário troque de foto
    abortActiveRequest();
    setErrorMsg(null);
    setIsBusyError(false);

    try {
      const compressed = await validateAndCompressPhoto(file);
      setSelectedPhoto(compressed);
      setSelectedFileName(file.name);
      setCurrentAnalysis(null);
    } catch (err) {
      setSelectedPhoto(null);
      setSelectedFileName('');
      setErrorMsg(err instanceof Error ? err.message : 'Arquivo de imagem inválido.');
    } finally {
      e.target.value = '';
    }
  };

  const handleSelectDemoPreset = (preset: 'sunset' | 'neon' | 'cozy', label: string) => {
    // Cancela requisição anterior caso o usuário troque de foto
    abortActiveRequest();
    setErrorMsg(null);
    setIsBusyError(false);

    const demo = generateSampleDemoPhoto(preset);
    setSelectedPhoto(demo);
    setSelectedFileName(label);
    setCurrentAnalysis(null);
  };

  const toggleChip = (current: string, value: string, setter: (val: string) => void) => {
    setter(current === value ? '' : value);
  };

  const runCountdownRetryWait = async (
    seconds: number,
    signal: AbortSignal
  ): Promise<void> => {
    setIsRetrying429(true);
    for (let rem = seconds; rem >= 1; rem--) {
      setRetryCountdownSeconds(rem);
      await waitAbortable(1000, signal);
    }
    setRetryCountdownSeconds(null);
  };

  const executePhotoAnalysis = async (options?: { bypassCache?: boolean }) => {
    const photoBase64 = selectedPhoto?.imageBase64 || currentAnalysis?.imageThumbnail;
    const photoThumb = selectedPhoto?.imageThumbnail || currentAnalysis?.imageThumbnail;
    if (!photoBase64 || !user || analyzing || regenerating || cooldownSeconds > 0) return;

    // Debounce no botão para evitar cliques repetidos
    const now = Date.now();
    if (now - lastSubmitTimestampRef.current < BUTTON_DEBOUNCE_MS) {
      return;
    }
    lastSubmitTimestampRef.current = now;

    if (!isOnline) {
      setErrorMsg(
        'Modo offline ativo. Novas análises exigem conexão — consulte seu Histórico salvo.'
      );
      setIsBusyError(false);
      return;
    }

    abortActiveRequest();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const startTime = Date.now();
    setErrorMsg(null);
    setIsBusyError(false);
    setIsRetrying429(false);
    setRetryCountdownSeconds(null);
    setAnalyzing(true);
    stopAll();

    // Se o servidor demorar além de ~3.2s por estar aplicando retry/backoff em 429,
    // atualiza a mensagem de etapa para informar que está tentando de novo
    const slowRetryHintTimer = window.setTimeout(() => {
      setIsRetrying429(true);
    }, 3200);

    try {
      const preferences = {
        genres: genres.trim() || undefined,
        language: language.trim() || undefined,
        era: era.trim() || undefined,
      };

      const isSimulationKeyword = /simulate_429/i.test(preferences.genres || '');
      const hashKey = await computePhotoAndFilterHash(photoBase64, preferences);

      if (!isSimulationKeyword && !options?.bypassCache) {
        const cachedAnalysis = getCachedAnalysisByHash(hashKey);
        if (cachedAnalysis && !cachedAnalysis.isFallback) {
          await ensureMinimumLoadingTime(startTime, controller.signal);
          setCurrentAnalysis(cachedAnalysis);
          setShowVibeNote(false);
          return;
        }
      }

      let responseData: { analysis: PhotoAnalysis; cached?: boolean };
      try {
        responseData = await apiService.createAnalysis(
          {
            imageBase64: photoBase64,
            imageThumbnail: photoThumb,
            preferences,
            bypassCache: options?.bypassCache,
          },
          { signal: controller.signal }
        );
      } catch (firstErr) {
        if (isAbortError(firstErr)) throw firstErr;

        if (
          firstErr instanceof ApiRequestError &&
          (firstErr.status === 429 || firstErr.status === 503 || firstErr.code === 'BUSY')
        ) {
          const waitSec = Math.min(Math.max(firstErr.retryAfterSeconds || 3, 2), 6);
          await runCountdownRetryWait(waitSec, controller.signal);
          responseData = await apiService.createAnalysis(
            {
              imageBase64: photoBase64,
              imageThumbnail: photoThumb,
              preferences,
              bypassCache: true,
            },
            { signal: controller.signal }
          );
        } else {
          throw firstErr;
        }
      }

      await ensureMinimumLoadingTime(startTime, controller.signal);

      // NUNCA salva resultados de fallback no cache local! Só cacheia análises reais da IA.
      if (!isSimulationKeyword && !responseData.analysis.isFallback) {
        setCachedAnalysisByHash(hashKey, responseData.analysis);
      }
      setCurrentAnalysis(responseData.analysis);
      setShowVibeNote(false);
      offlineCacheService.prependAnalysis(user.id, responseData.analysis);
    } catch (err) {
      if (isAbortError(err)) {
        return;
      }

      try {
        await ensureMinimumLoadingTime(startTime, controller.signal);
      } catch {
        return;
      }

      if (
        err instanceof ApiRequestError &&
        (err.status === 429 || err.status === 503 || err.code === 'BUSY')
      ) {
        setIsBusyError(true);
        setCooldownSeconds(Math.max(err.retryAfterSeconds || 5, 3));
        setErrorMsg('A banda está ocupada. Tente de novo em alguns segundos');
      } else {
        setIsBusyError(true);
        setCooldownSeconds(3);
        setErrorMsg(
          err instanceof Error
            ? err.message
            : 'A banda está ocupada. Tente de novo em alguns segundos'
        );
      }
    } finally {
      window.clearTimeout(slowRetryHintTimer);
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
        setAnalyzing(false);
        setIsRetrying429(false);
        setRetryCountdownSeconds(null);
      }
    }
  };

  const handleAnalyzeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await executePhotoAnalysis();
  };

  const handleRegenerate = async () => {
    if (!currentAnalysis || !user || regenerating || analyzing || cooldownSeconds > 0) return;

    const now = Date.now();
    if (now - lastSubmitTimestampRef.current < BUTTON_DEBOUNCE_MS) {
      return;
    }
    lastSubmitTimestampRef.current = now;

    if (!isOnline) {
      setErrorMsg('Sem conexão com a internet. Conecte-se para gerar novas sugestões.');
      return;
    }

    abortActiveRequest();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const startTime = Date.now();
    setErrorMsg(null);
    setIsBusyError(false);
    setIsRetrying429(false);
    setRetryCountdownSeconds(null);
    setRegenerating(true);
    stopAll();

    const slowRetryHintTimer = window.setTimeout(() => {
      setIsRetrying429(true);
    }, 3200);

    try {
      const res = await apiService.regenerateAnalysis(currentAnalysis.id, {
        signal: controller.signal,
      });
      await ensureMinimumLoadingTime(startTime, controller.signal);
      setCurrentAnalysis(res.analysis);
      offlineCacheService.prependAnalysis(user.id, res.analysis);
    } catch (err) {
      if (isAbortError(err)) return;

      try {
        await ensureMinimumLoadingTime(startTime, controller.signal);
      } catch {
        return;
      }

      if (
        err instanceof ApiRequestError &&
        (err.status === 429 || err.status === 503 || err.code === 'BUSY')
      ) {
        setIsBusyError(true);
        setCooldownSeconds(Math.max(err.retryAfterSeconds || 5, 3));
        setErrorMsg('A banda está ocupada. Tente de novo em alguns segundos');
      } else {
        setErrorMsg(
          err instanceof Error
            ? err.message
            : 'A banda está ocupada. Tente de novo em alguns segundos'
        );
      }
    } finally {
      window.clearTimeout(slowRetryHintTimer);
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
        setRegenerating(false);
        setIsRetrying429(false);
        setRetryCountdownSeconds(null);
      }
    }
  };

  const handleResetForNewPhoto = () => {
    abortActiveRequest();
    stopAll();
    setErrorMsg(null);
    setIsBusyError(false);
    setCooldownSeconds(0);
    setCurrentAnalysis(null);
    setSelectedPhoto(null);
    setSelectedFileName('');
  };

  const liveCaption = formatPolaroidCaption({ genres, language, era });
  const topTrack = currentAnalysis?.recommendations?.[0] || null;
  const otherTracks = currentAnalysis?.recommendations?.slice(1) || [];
  const activeLoadingPhoto =
    selectedPhoto?.imageThumbnail || currentAnalysis?.imageThumbnail || null;
  const isFallbackResult = Boolean(currentAnalysis?.isFallback);

  return (
    <div>
      {/* 3. Título gigante em vermelho em duas linhas: "QUAL É / A FOTO?" */}
      <TitleHero line1="QUAL É" line2="A FOTO?" />

      {/* Aviso de erro amigável no mesmo visual retrô com botão "TENTAR DE NOVO" e cooldown */}
      {!analyzing && !regenerating && errorMsg && (
        <div
          role="alert"
          aria-live="polite"
          className="mb-5 rounded-[22px] border-2 border-poster-red bg-poster-paper p-4 text-poster-ink shadow-sm"
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-poster-red" />
            <div className="min-w-0 flex-1">
              <p className="font-display text-xs font-black uppercase tracking-wide text-poster-red sm:text-sm">
                {errorMsg}
              </p>
              <p className="mt-1 text-xs text-poster-muted">
                Sua foto e seus filtros musicais continuam salvos aqui embaixo.
              </p>
            </div>
          </div>

          {isBusyError && selectedPhoto && (
            <div className="mt-3.5">
              <PrimaryPillButton
                type="button"
                disabled={cooldownSeconds > 0 || analyzing || regenerating}
                icon={<RefreshCw className="h-4 w-4 stroke-[2.4]" />}
                onClick={() => {
                  void executePhotoAnalysis({ bypassCache: true });
                }}
              >
                {cooldownSeconds > 0
                  ? `TENTAR DE NOVO (${cooldownSeconds}s)`
                  : 'TENTAR DE NOVO'}
              </PrimaryPillButton>
            </div>
          )}
        </div>
      )}

      {/* ESTADO DE CARREGAMENTO MUSICAL RETRÔ COM VINIL, NOTAS, EQUALIZADOR E ETAPAS */}
      {(analyzing || regenerating) && (
        <MusicalLoadingStage
          photoSrc={activeLoadingPhoto}
          caption={liveCaption}
          isRetrying429={isRetrying429}
          retryCountdownSeconds={retryCountdownSeconds}
        />
      )}

      {/* ESTADO COM RESULTADO DA ANÁLISE (LAYOUT PÔSTER RETRÔ COMPLETO) */}
      {!analyzing && !regenerating && currentAnalysis && topTrack && (
        <section className="space-y-5">
          {/* AVISO VISÍVEL QUANDO isFallback FOR TRUE (Parte 3) */}
          {isFallbackResult && (
            <div
              role="alert"
              aria-live="polite"
              className="rounded-[22px] border-2 border-poster-red bg-poster-redLight/75 p-4 text-poster-ink shadow-sm"
            >
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-poster-red" />
                <div className="min-w-0 flex-1">
                  <p className="font-display text-xs font-black uppercase leading-snug tracking-wide text-poster-red sm:text-sm">
                    Não conseguimos analisar sua foto agora. Mostrando sugestões populares.
                  </p>
                  <p className="mt-1 text-xs font-medium text-poster-ink">
                    {getFallbackReasonMessage(currentAnalysis.fallbackReason)}
                  </p>
                </div>
              </div>

              <div className="mt-3.5">
                <PrimaryPillButton
                  type="button"
                  disabled={analyzing || regenerating || cooldownSeconds > 0}
                  icon={<RefreshCw className="h-4 w-4 stroke-[2.4]" />}
                  onClick={() => {
                    void executePhotoAnalysis({ bypassCache: true });
                  }}
                >
                  {cooldownSeconds > 0
                    ? `TENTAR DE NOVO (${cooldownSeconds}s)`
                    : 'TENTAR DE NOVO'}
                </PrimaryPillButton>
              </div>
            </div>
          )}

          {/* 4. Linha com dois blocos lado a lado: Polaroid à esquerda + Cartão Vermelho à direita */}
          <div className="grid grid-cols-[46%_1fr] items-stretch gap-3.5 sm:gap-4">
            <div className="flex flex-col justify-center">
              <PolaroidPhoto
                imageSrc={currentAnalysis.imageThumbnail}
                caption={formatPolaroidCaption(currentAnalysis.preferences)}
                alt="Fotografia analisada em moldura Polaroid"
              />
            </div>

            <TopTrackCard
              track={topTrack}
              isFallback={isFallbackResult}
              onShareTrack={(t) => setShareTarget(t)}
            />
          </div>

          {/* Nota Editorial da Vibe Detectada pela IA (RF-004) */}
          <div className="rounded-2xl border border-poster-border bg-poster-paper px-3.5 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-extrabold uppercase tracking-[0.2em] text-poster-red">
                  {isFallbackResult ? 'MODO SUGESTÕES POPULARES' : 'LEITURA DA VIBE'}
                </span>
                <div className="flex items-center gap-1">
                  {currentAnalysis.dominantColors?.map((hex, idx) => (
                    <span
                      key={idx}
                      title={`Cor dominante: ${hex}`}
                      className="h-3 w-3 rounded-full border border-poster-ink/20"
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowVibeNote((prev) => !prev)}
                className="text-[10px] font-extrabold uppercase tracking-wider text-poster-ink underline-offset-2 hover:text-poster-red hover:underline"
              >
                {showVibeNote ? 'Recolher' : isFallbackResult ? 'Ver Aviso' : 'Ler Clima'}
              </button>
            </div>

            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {currentAnalysis.moodTags.map((tag, idx) => (
                <span
                  key={idx}
                  className="rounded-full border border-poster-border bg-poster-cream px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-poster-ink"
                >
                  #{tag}
                </span>
              ))}
            </div>

            {showVibeNote && (
              <p className="mt-2 border-t border-poster-border pt-2 text-xs leading-relaxed text-poster-ink">
                {currentAnalysis.vibeSummary}
              </p>
            )}
          </div>

          {/* 5. Divisor xadrez fino */}
          <CheckerDivider className="my-5" />

          {/* 6. Seção "TAMBÉM COMBINA": Lista com as demais sugestões (2 a 5) */}
          <div>
            <h3 className="mb-1 text-[10px] font-extrabold uppercase tracking-[0.22em] text-poster-ink">
              {isFallbackResult ? 'OUTRAS SUGESTÕES POPULARES' : 'TAMBÉM COMBINA'}
            </h3>

            <div className="divide-y divide-poster-border">
              {otherTracks.map((track) => (
                <TrackListItem
                  key={track.id}
                  track={track}
                  isFallback={isFallbackResult}
                  onShareTrack={(t) => setShareTarget(t)}
                />
              ))}
            </div>
          </div>

          {/* 7. Botão principal em formato pílula, largura total, vermelho: "NOVA FOTO" */}
          <div className="space-y-2.5 pt-3">
            <PrimaryPillButton
              icon={<RotateCcw className="h-4 w-4 stroke-[2.5]" />}
              onClick={handleResetForNewPhoto}
            >
              NOVA FOTO
            </PrimaryPillButton>

            {/* Botão secundário para "Gerar Novas Sugestões" para a mesma foto (RF-007) */}
            <PrimaryPillButton
              variant="outline"
              disabled={regenerating || analyzing || cooldownSeconds > 0}
              icon={<RefreshCw className="h-4 w-4 stroke-[2.2]" />}
              onClick={handleRegenerate}
            >
              OUTRAS MÚSICAS P/ ESTA FOTO
            </PrimaryPillButton>
          </div>
        </section>
      )}

      {/* ESTADO INICIAL DE UPLOAD E FILTROS (QUANDO NÃO HÁ FOTO ANALISADA) */}
      {!analyzing && !regenerating && !currentAnalysis && (
        <form onSubmit={handleAnalyzeSubmit} className="space-y-5">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            className="hidden"
          />

          {/* Linha com os dois blocos lado a lado: Polaroid de Upload + Card Editorial */}
          <div className="grid grid-cols-[46%_1fr] items-stretch gap-3.5 sm:gap-4">
            <div className="flex flex-col justify-center">
              <PolaroidPhoto
                imageSrc={selectedPhoto?.imageThumbnail}
                caption={liveCaption}
                onClick={() => fileInputRef.current?.click()}
                actionLabel={selectedPhoto ? 'TROCAR' : 'ENVIAR'}
              />
            </div>

            <div className="flex flex-col justify-between rounded-[26px] bg-poster-red p-4 text-poster-cream shadow-poster">
              <div>
                <span className="block text-[9px] font-extrabold uppercase tracking-[0.22em] text-poster-cream/90">
                  PASSO 01 · REVELAÇÃO
                </span>

                <h2 className="mt-2 font-display text-base font-black uppercase leading-tight tracking-tight text-white sm:text-lg">
                  {selectedPhoto ? 'FOTO PRONTA!' : 'ESCOLHA SUA FOTO'}
                </h2>

                <p className="mt-1 text-xs leading-snug text-poster-cream/90">
                  {selectedPhoto
                    ? selectedFileName
                    : 'Envie um clique da galeria ou teste uma cena abaixo.'}
                </p>
              </div>

              <div className="mt-3 space-y-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-full bg-poster-cream px-3 py-2 font-display text-[10px] font-black uppercase tracking-wider text-poster-red shadow-sm transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  <Camera className="h-3.5 w-3.5" />
                  <span>{selectedPhoto ? 'TROCAR ARQUIVO' : 'ABRIR GALERIA'}</span>
                </button>

                <p className="text-center text-[9px] font-bold uppercase tracking-[0.15em] text-poster-cream/85">
                  JPEG · PNG · WEBP (ATÉ 10MB)
                </p>
              </div>
            </div>
          </div>

          {/* Cenas rápidas de demonstração em estilo pílula retrô */}
          <div className="rounded-2xl border border-poster-border bg-poster-paper p-3">
            <p className="mb-2 text-[9px] font-extrabold uppercase tracking-[0.2em] text-poster-ink">
              SEM FOTO AGORA? TESTE COM UMA CENA DE EXEMPLO:
            </p>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => handleSelectDemoPreset('sunset', 'Pôr do Sol Dourado')}
                className="min-h-[38px] rounded-full border border-poster-red/40 bg-poster-cream px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-poster-ink transition hover:border-poster-red hover:bg-poster-red hover:text-poster-cream"
              >
                Pôr do Sol
              </button>
              <button
                type="button"
                onClick={() => handleSelectDemoPreset('neon', 'Noite Urbana Neon')}
                className="min-h-[38px] rounded-full border border-poster-red/40 bg-poster-cream px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-poster-ink transition hover:border-poster-red hover:bg-poster-red hover:text-poster-cream"
              >
                Noite Neon
              </button>
              <button
                type="button"
                onClick={() => handleSelectDemoPreset('cozy', 'Café & Tarde Calma')}
                className="min-h-[38px] rounded-full border border-poster-red/40 bg-poster-cream px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-poster-ink transition hover:border-poster-red hover:bg-poster-red hover:text-poster-cream"
              >
                Café Calmo
              </button>
            </div>
          </div>

          <CheckerDivider />

          {/* Filtros Opcionais (Gênero, Idioma, Época) em Chips/Pílulas Vermelhas e Creme (RF-002) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-poster-ink">
                DICA MUSICAL (OPCIONAL)
              </span>
              <button
                type="button"
                onClick={() => setShowFilters((prev) => !prev)}
                aria-expanded={showFilters}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-poster-red px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-poster-red transition hover:bg-poster-red hover:text-poster-cream"
              >
                <SlidersHorizontal className="h-3 w-3" />
                <span>{showFilters ? 'Fechar Filtros' : 'Escolher Estilo'}</span>
              </button>
            </div>

            {/* Chips rápidos de gênero sempre acessíveis */}
            <div className="flex flex-wrap gap-1.5">
              {GENRE_CHIPS.map((chip) => {
                const active = genres.toLowerCase() === chip.toLowerCase();
                return (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => toggleChip(genres, chip, setGenres)}
                    className={`min-h-[38px] rounded-full border px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider transition ${
                      active
                        ? 'border-poster-red bg-poster-red text-poster-cream shadow-sm'
                        : 'border-poster-border bg-poster-paper text-poster-ink hover:border-poster-red'
                    }`}
                  >
                    {chip}
                  </button>
                );
              })}
            </div>

            {/* Gaveta de filtros adicionais (Idioma, Época e Estilo livre) */}
            {showFilters && (
              <div className="space-y-3 rounded-2xl border border-poster-border bg-poster-paper p-3.5">
                <div>
                  <label className="mb-1 block text-[9px] font-extrabold uppercase tracking-[0.2em] text-poster-ink">
                    OU DIGITE SEU GÊNERO / ESTILO:
                  </label>
                  <input
                    type="text"
                    value={genres}
                    onChange={(e) => setGenres(e.target.value)}
                    placeholder="Ex.: Dreampop, Jazz, R&B..."
                    className="w-full rounded-full border border-poster-border bg-poster-cream px-3.5 py-2 text-xs font-medium text-poster-ink placeholder-poster-muted focus:border-poster-red focus:outline-none"
                  />
                </div>

                <div>
                  <span className="mb-1.5 block text-[9px] font-extrabold uppercase tracking-[0.2em] text-poster-ink">
                    IDIOMA:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {LANGUAGE_CHIPS.map((lang) => {
                      const active = language === lang;
                      return (
                        <button
                          key={lang}
                          type="button"
                          onClick={() => toggleChip(language, lang, setLanguage)}
                          className={`min-h-[36px] rounded-full border px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider transition ${
                            active
                              ? 'border-poster-red bg-poster-red text-poster-cream'
                              : 'border-poster-border bg-poster-cream text-poster-ink hover:border-poster-red'
                          }`}
                        >
                          {lang}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <span className="mb-1.5 block text-[9px] font-extrabold uppercase tracking-[0.2em] text-poster-ink">
                    ÉPOCA / DÉCADA:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {ERA_CHIPS.map((decade) => {
                      const active = era === decade;
                      return (
                        <button
                          key={decade}
                          type="button"
                          onClick={() => toggleChip(era, decade, setEra)}
                          className={`min-h-[36px] rounded-full border px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider transition ${
                            active
                              ? 'border-poster-red bg-poster-red text-poster-cream'
                              : 'border-poster-border bg-poster-cream text-poster-ink hover:border-poster-red'
                          }`}
                        >
                          {decade}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Botão Principal Pílula para Analisar a Foto */}
          <div className="pt-2">
            <PrimaryPillButton
              type="submit"
              disabled={!selectedPhoto || analyzing || regenerating || cooldownSeconds > 0}
              icon={<Sparkles className="h-4 w-4" />}
            >
              {analyzing
                ? 'ANALISANDO FOTO...'
                : cooldownSeconds > 0
                ? `AGUARDE (${cooldownSeconds}s)...`
                : 'ANALISAR FOTO'}
            </PrimaryPillButton>
          </div>
        </form>
      )}

      {/* Modal do Card Compartilhável (RF-009) */}
      {currentAnalysis && shareTarget && (
        <ShareCardModal
          analysis={currentAnalysis}
          track={shareTarget}
          onClose={() => setShareTarget(null)}
        />
      )}
    </div>
  );
};
