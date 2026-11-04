import { getCacheTtlMs, isProductionEnv } from '../config/env';
import { RecommendationInput } from '../repositories/analysis.repository';
import {
  logServiceAttempt,
  musicConcurrencyQueue,
  TtlCache,
  UpstreamServiceError,
  withRetryWithBackoff,
} from '../utils/resilience.util';
import { AiTrackSuggestion, Simulate429Mode } from './ai-vision.service';

interface ItunesTrackResult {
  trackName?: string;
  artistName?: string;
  artworkUrl100?: string;
  previewUrl?: string;
  trackViewUrl?: string;
}

interface ItunesSearchResponse {
  resultCount?: number;
  results?: ItunesTrackResult[];
}

interface CachedTrackMetadata {
  albumArtUrl: string | null;
  previewUrl: string | null;
  hasPreview: boolean;
  externalUrl: string;
  externalProvider: string;
}

const musicQueryCache = new TtlCache<CachedTrackMetadata>();

export function clearMusicCatalogCache(): void {
  musicQueryCache.clear();
}

function normalizeQueryKey(title: string, artist: string): string {
  return `${title.trim().toLowerCase()}::${artist.trim().toLowerCase()}`;
}

function normalizeToken(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchesSuggestion(item: ItunesTrackResult, suggestion: AiTrackSuggestion): boolean {
  const itemTrack = normalizeToken(item.trackName || '');
  const itemArtist = normalizeToken(item.artistName || '');
  const targetTitle = normalizeToken(suggestion.title);
  const targetArtist = normalizeToken(suggestion.artist.split(/[,&]/)[0] || suggestion.artist);

  if (!itemTrack || !targetTitle) return false;
  const titleMatches =
    itemTrack.includes(targetTitle) || targetTitle.includes(itemTrack);
  const artistMatches =
    !targetArtist || itemArtist.includes(targetArtist) || targetArtist.includes(itemArtist);

  return titleMatches && artistMatches;
}

/**
 * Serviço responsável por enriquecer as recomendações da IA com metadados reais
 * (capa do álbum, prévia de áudio de 30s e link externo) via iTunes Search API,
 * aplicando:
 * - Cache por consulta musical (TTL configurável);
 * - Busca em lote (1 requisição agregada quando possível);
 * - Fila de concorrência (MAX_CONCURRENT_MUSIC) + Retry com Backoff (MAX_RETRIES);
 * - Fallback gracioso ("Preview indisponível agora") caso o serviço de música falhe.
 */
export class MusicCatalogService {
  async enrichTracks(
    suggestions: AiTrackSuggestion[],
    simulateMode: Simulate429Mode = 'none'
  ): Promise<RecommendationInput[]> {
    const ttlMs = getCacheTtlMs();
    const resultsByIndex = new Map<number, RecommendationInput>();
    const pendingSuggestions: Array<{ index: number; suggestion: AiTrackSuggestion }> = [];

    // 1. Verifica faixas com atenuação forçada ou já presentes no cache por consulta
    suggestions.forEach((suggestion, index) => {
      const rankOrder = index + 1;
      const spotifySearchUrl = `https://open.spotify.com/search/${encodeURIComponent(
        `${suggestion.title} ${suggestion.artist}`
      )}`;

      if (!isProductionEnv() && suggestion.forceAttenuatedPreview) {
        resultsByIndex.set(index, {
          rankOrder,
          title: suggestion.title,
          artist: suggestion.artist,
          albumArtUrl: null,
          reason: suggestion.reason,
          previewUrl: null,
          hasPreview: false,
          externalUrl: spotifySearchUrl,
          externalProvider: 'Preview indisponível agora',
        });
        return;
      }

      if (simulateMode === 'none') {
        const key = normalizeQueryKey(suggestion.title, suggestion.artist);
        const cached = musicQueryCache.get(key);
        if (cached) {
          resultsByIndex.set(index, {
            rankOrder,
            title: suggestion.title,
            artist: suggestion.artist,
            albumArtUrl: cached.albumArtUrl,
            reason: suggestion.reason,
            previewUrl: cached.previewUrl,
            hasPreview: cached.hasPreview,
            externalUrl: cached.externalUrl,
            externalProvider: cached.externalProvider,
          });
          return;
        }
      }

      pendingSuggestions.push({ index, suggestion });
    });

    // 2. Redução de chamadas: busca em lote (1 única requisição para as faixas pendentes)
    let musicServiceUnavailable = false;
    if (pendingSuggestions.length > 0) {
      try {
        const batchCatalogItems = await this.fetchBatchCatalogItems(
          pendingSuggestions.map((p) => p.suggestion),
          simulateMode
        );

        const stillUnmatched: Array<{ index: number; suggestion: AiTrackSuggestion }> = [];

        for (const pending of pendingSuggestions) {
          const candidates = batchCatalogItems.filter((item) =>
            matchesSuggestion(item, pending.suggestion)
          );
          const matchWithPreview = candidates.find((c) => Boolean(c.previewUrl));
          const bestMatch = matchWithPreview || candidates[0];

          if (bestMatch) {
            const enriched = this.mapItunesMatchToRecommendation(
              pending.suggestion,
              pending.index + 1,
              bestMatch
            );
            resultsByIndex.set(pending.index, enriched);
            if (simulateMode === 'none') {
              musicQueryCache.set(
                normalizeQueryKey(pending.suggestion.title, pending.suggestion.artist),
                {
                  albumArtUrl: enriched.albumArtUrl ?? null,
                  previewUrl: enriched.previewUrl ?? null,
                  hasPreview: Boolean(enriched.hasPreview),
                  externalUrl: enriched.externalUrl,
                  externalProvider: enriched.externalProvider || 'Apple Music / Spotify',
                },
                ttlMs
              );
            }
          } else {
            stillUnmatched.push(pending);
          }
        }

        // 3. Para faixas que não vieram no lote agregado, busca respeitando a fila MAX_CONCURRENT_MUSIC
        for (const unmatched of stillUnmatched) {
          if (musicServiceUnavailable) {
            resultsByIndex.set(
              unmatched.index,
              this.buildFallbackTrack(unmatched.suggestion, unmatched.index + 1)
            );
            continue;
          }

          try {
            const singleResult = await this.resolveSingleTrackWithResilience(
              unmatched.suggestion,
              unmatched.index + 1,
              simulateMode
            );
            resultsByIndex.set(unmatched.index, singleResult);
            if (simulateMode === 'none') {
              musicQueryCache.set(
                normalizeQueryKey(unmatched.suggestion.title, unmatched.suggestion.artist),
                {
                  albumArtUrl: singleResult.albumArtUrl ?? null,
                  previewUrl: singleResult.previewUrl ?? null,
                  hasPreview: Boolean(singleResult.hasPreview),
                  externalUrl: singleResult.externalUrl,
                  externalProvider: singleResult.externalProvider || 'Spotify',
                },
                ttlMs
              );
            }
          } catch {
            musicServiceUnavailable = true;
            resultsByIndex.set(
              unmatched.index,
              this.buildFallbackTrack(unmatched.suggestion, unmatched.index + 1)
            );
          }
        }
      } catch (err) {
        // 4. Fallback gracioso (Parte 2 Item 5): se o serviço de música continuar falhando após retries,
        // devolve todas as sugestões da IA sem preview ("Preview indisponível agora") em vez de falhar a análise.
        logServiceAttempt({
          service: 'MUSIC_CATALOG',
          attempt: 1,
          maxAttempts: 1,
          status: 429,
          waitMs: 0,
          errorBody:
            err instanceof Error
              ? `Fallback gracioso ativado (sem preview): ${err.message}`
              : 'Fallback gracioso ativado para catálogo musical',
          outcome: 'FALLBACK',
        });

        for (const pending of pendingSuggestions) {
          if (!resultsByIndex.has(pending.index)) {
            resultsByIndex.set(
              pending.index,
              this.buildFallbackTrack(pending.suggestion, pending.index + 1)
            );
          }
        }
      }
    }

    const enrichedResults = suggestions.map(
      (s, idx) => resultsByIndex.get(idx) || this.buildFallbackTrack(s, idx + 1)
    );

    // Prioriza músicas com prévia de áudio disponível no topo da lista (RF-006 / RT-006)
    const sorted = enrichedResults.sort((a, b) => {
      if (a.hasPreview === b.hasPreview) {
        return a.rankOrder - b.rankOrder;
      }
      return a.hasPreview ? -1 : 1;
    });

    return sorted.map((item, idx) => ({
      ...item,
      rankOrder: idx + 1,
    }));
  }

  private async fetchBatchCatalogItems(
    suggestions: AiTrackSuggestion[],
    simulateMode: Simulate429Mode
  ): Promise<ItunesTrackResult[]> {
    const combinedQuery = suggestions
      .map((s) => `${s.title} ${s.artist.split(/[,&]/)[0]}`)
      .slice(0, 5)
      .join(' ');

    return musicConcurrencyQueue.run(() =>
      withRetryWithBackoff(
        {
          service: 'MUSIC_CATALOG',
        },
        async (attempt) => {
          if (simulateMode === 'always_429_music') {
            throw new UpstreamServiceError({
              service: 'MUSIC_CATALOG',
              status: 429,
              retryAfterHeader: '1',
              message: `Simulated 429 Too Many Requests on Music Catalog (attempt ${attempt})`,
              errorBody: '{"error":"Music search rate limit exceeded"}',
            });
          }

          const encoded = encodeURIComponent(combinedQuery);
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 3800);

          try {
            const response = await fetch(
              `https://itunes.apple.com/search?term=${encoded}&entity=song&limit=25`,
              { signal: controller.signal }
            );
            clearTimeout(timeout);

            if (!response.ok) {
              const retryAfter = response.headers.get('retry-after');
              const errorText = await response.text().catch(() => '');
              throw new UpstreamServiceError({
                service: 'MUSIC_CATALOG',
                status: response.status,
                retryAfterHeader: retryAfter,
                message: `iTunes batch search HTTP ${response.status}`,
                errorBody: errorText || `HTTP ${response.status}`,
              });
            }

            const data = (await response.json()) as ItunesSearchResponse;
            return data.results || [];
          } finally {
            clearTimeout(timeout);
          }
        }
      )
    );
  }

  private async resolveSingleTrackWithResilience(
    suggestion: AiTrackSuggestion,
    initialRank: number,
    simulateMode: Simulate429Mode
  ): Promise<RecommendationInput> {
    return musicConcurrencyQueue.run(() =>
      withRetryWithBackoff(
        {
          service: 'MUSIC_CATALOG',
        },
        async (attempt) => {
          if (simulateMode === 'always_429_music') {
            throw new UpstreamServiceError({
              service: 'MUSIC_CATALOG',
              status: 429,
              retryAfterHeader: '1',
              message: `Simulated 429 on single track lookup (attempt ${attempt})`,
              errorBody: '{"error":"Music search rate limit exceeded"}',
            });
          }

          const query = encodeURIComponent(`${suggestion.title} ${suggestion.artist}`);
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 3800);

          try {
            const response = await fetch(
              `https://itunes.apple.com/search?term=${query}&entity=song&limit=3`,
              { signal: controller.signal }
            );
            clearTimeout(timeout);

            if (!response.ok) {
              const retryAfter = response.headers.get('retry-after');
              const errorText = await response.text().catch(() => '');
              throw new UpstreamServiceError({
                service: 'MUSIC_CATALOG',
                status: response.status,
                retryAfterHeader: retryAfter,
                message: `iTunes track search HTTP ${response.status}`,
                errorBody: errorText || `HTTP ${response.status}`,
              });
            }

            const data = (await response.json()) as ItunesSearchResponse;
            const matchWithPreview = data.results?.find((r) => Boolean(r.previewUrl));
            const bestMatch = matchWithPreview || data.results?.[0];

            if (bestMatch) {
              return this.mapItunesMatchToRecommendation(suggestion, initialRank, bestMatch);
            }

            return this.buildFallbackTrack(suggestion, initialRank);
          } finally {
            clearTimeout(timeout);
          }
        }
      )
    );
  }

  private mapItunesMatchToRecommendation(
    suggestion: AiTrackSuggestion,
    rankOrder: number,
    bestMatch: ItunesTrackResult
  ): RecommendationInput {
    const spotifySearchUrl = `https://open.spotify.com/search/${encodeURIComponent(
      `${suggestion.title} ${suggestion.artist}`
    )}`;
    const highResArt = bestMatch.artworkUrl100
      ? bestMatch.artworkUrl100.replace('100x100bb', '600x600bb')
      : null;
    const previewUrl = bestMatch.previewUrl || null;

    return {
      rankOrder,
      title: suggestion.title,
      artist: suggestion.artist,
      albumArtUrl: highResArt,
      reason: suggestion.reason,
      previewUrl,
      hasPreview: Boolean(previewUrl),
      externalUrl: bestMatch.trackViewUrl || spotifySearchUrl,
      externalProvider: previewUrl
        ? bestMatch.trackViewUrl
          ? 'Apple Music / Spotify'
          : 'Spotify'
        : 'Preview indisponível agora',
    };
  }

  public buildFallbackTrack(
    suggestion: AiTrackSuggestion,
    rankOrder: number
  ): RecommendationInput {
    const spotifySearchUrl = `https://open.spotify.com/search/${encodeURIComponent(
      `${suggestion.title} ${suggestion.artist}`
    )}`;

    return {
      rankOrder,
      title: suggestion.title,
      artist: suggestion.artist,
      albumArtUrl: null,
      reason: suggestion.reason,
      previewUrl: null,
      hasPreview: false,
      externalUrl: spotifySearchUrl,
      externalProvider: 'Preview indisponível agora',
    };
  }
}

export const musicCatalogService = new MusicCatalogService();
