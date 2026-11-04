import { getCacheTtlMs, isProductionEnv } from '../config/env';
import {
  analysisRepository,
  RecommendationInput,
} from '../repositories/analysis.repository';
import { AppError } from '../utils/errors.util';
import { TtlCache } from '../utils/resilience.util';
import {
  aiVisionService,
  FallbackReason,
  MusicPreferences,
  resolveSimulationMode,
} from './ai-vision.service';
import { musicCatalogService } from './music-catalog.service';

export interface CreateAnalysisInput {
  userId: string;
  imageBase64: string;
  imageThumbnail?: string;
  preferences?: MusicPreferences;
  simulate429Mode?: string;
  bypassCache?: boolean;
}

interface CachedEnrichedEntry {
  vibeSummary: string;
  moodTags: string[];
  dominantColors: string[];
  recommendations: RecommendationInput[];
  isFallback: boolean;
}

const enrichedAnalysisCache = new TtlCache<CachedEnrichedEntry>();

export function clearAnalysisCache(): void {
  enrichedAnalysisCache.clear();
}

export class AnalysisService {
  async createAnalysis(input: CreateAnalysisInput) {
    // 1. Valida a imagem e calcula o hash da foto + filtros escolhidos para cache
    const { rawBase64 } = aiVisionService.parseAndValidateImage(input.imageBase64);
    const activeSimMode = resolveSimulationMode(input.preferences, input.simulate429Mode);
    const cacheHash = aiVisionService.computeAnalysisHash(rawBase64, input.preferences);
    const ttlMs = getCacheTtlMs();

    let vibeSummary: string;
    let moodTags: string[];
    let dominantColors: string[];
    let enrichedRecommendations: RecommendationInput[];
    let isFallback = false;
    let fallbackReason: FallbackReason | undefined;
    let upstreamStatus: number | undefined;
    let fromCache = false;

    const cached =
      activeSimMode === 'none' && !input.bypassCache
        ? enrichedAnalysisCache.get(cacheHash)
        : null;

    if (cached && !cached.isFallback) {
      vibeSummary = cached.vibeSummary;
      moodTags = cached.moodTags;
      dominantColors = cached.dominantColors;
      enrichedRecommendations = cached.recommendations;
      isFallback = false;
      fromCache = true;
    } else {
      // 2. Executa análise de IA com fila de concorrência e retry com backoff (RF-002 / RF-004)
      const visionResult = await aiVisionService.analyzePhoto(
        input.imageBase64,
        input.preferences,
        [],
        input.simulate429Mode,
        { bypassCache: input.bypassCache }
      );

      // 3. Enriquece com catálogo musical em lote, com cache por consulta e fallback gracioso (RF-005 / RF-006)
      enrichedRecommendations = await musicCatalogService.enrichTracks(
        visionResult.tracks,
        activeSimMode
      );
      vibeSummary = visionResult.vibeSummary;
      moodTags = visionResult.moodTags;
      dominantColors = visionResult.dominantColors;
      isFallback = visionResult.isFallback;
      fallbackReason = visionResult.fallbackReason;
      upstreamStatus = visionResult.upstreamStatus;

      // NUNCA salva resultados de fallback no cache! Só cacheia respostas reais da IA.
      if (!visionResult.isFallback && activeSimMode === 'none') {
        enrichedAnalysisCache.set(
          cacheHash,
          {
            vibeSummary,
            moodTags,
            dominantColors,
            recommendations: enrichedRecommendations,
            isFallback: false,
          },
          ttlMs
        );
      }
    }

    // 4. Persiste a análise + recomendações no histórico do usuário
    const thumbnailToSave = input.imageThumbnail?.trim() || input.imageBase64;
    const cleanGenres = isProductionEnv()
      ? input.preferences?.genres?.trim()
      : input.preferences?.genres?.replace(/simulate_429_[a-z_]+/gi, '').trim();

    const savedAnalysis = await analysisRepository.create({
      userId: input.userId,
      imageThumbnail: thumbnailToSave,
      prefGenres: cleanGenres || null,
      prefLanguage: input.preferences?.language?.trim() || null,
      prefEra: input.preferences?.era?.trim() || null,
      vibeSummary,
      moodTags,
      dominantColors,
      recommendations: enrichedRecommendations,
    });

    return {
      analysis: this.formatAnalysisResponse(savedAnalysis, {
        isFallback,
        fallbackReason,
        upstreamStatus,
      }),
      cached: fromCache,
    };
  }

  /**
   * Gera novas sugestões musicais inéditas para uma foto já analisada (RF-007 / RT-007).
   */
  async regenerateAnalysis(
    userId: string,
    originalAnalysisId: string,
    simulate429Mode?: string
  ) {
    // 1. Verifica se a análise original existe e pertence ao usuário
    const original = await analysisRepository.findByIdAndUserId(originalAnalysisId, userId);
    if (!original) {
      throw new AppError('Análise original não encontrada.', 404, 'ANALYSIS_NOT_FOUND');
    }

    // 2. Coleta músicas já sugeridas na análise original para evitar repetição
    const excludedTitles = original.recommendations.map((r) => r.title);
    const preferences: MusicPreferences = {
      genres: original.prefGenres || undefined,
      language: original.prefLanguage || undefined,
      era: original.prefEra || undefined,
    };

    const activeSimMode = resolveSimulationMode(preferences, simulate429Mode);

    // 3. Solicita nova curadoria para a mesma imagem (ignorando cache para forçar nova consulta)
    const visionResult = await aiVisionService.analyzePhoto(
      original.imageThumbnail,
      preferences,
      excludedTitles,
      simulate429Mode,
      { bypassCache: true }
    );

    const enrichedRecommendations = await musicCatalogService.enrichTracks(
      visionResult.tracks,
      activeSimMode
    );

    const savedAnalysis = await analysisRepository.create({
      userId,
      imageThumbnail: original.imageThumbnail,
      prefGenres: original.prefGenres,
      prefLanguage: original.prefLanguage,
      prefEra: original.prefEra,
      vibeSummary: visionResult.vibeSummary,
      moodTags: visionResult.moodTags,
      dominantColors: visionResult.dominantColors,
      recommendations: enrichedRecommendations,
    });

    return {
      analysis: this.formatAnalysisResponse(savedAnalysis, {
        isFallback: visionResult.isFallback,
        fallbackReason: visionResult.fallbackReason,
        upstreamStatus: visionResult.upstreamStatus,
      }),
    };
  }

  async listUserAnalyses(userId: string) {
    const list = await analysisRepository.findAllByUserId(userId);
    return {
      analyses: list.map((item) => this.formatAnalysisResponse(item)),
    };
  }

  async deleteUserAnalysis(userId: string, analysisId: string) {
    const deleted = await analysisRepository.deleteByIdAndUserId(analysisId, userId);
    if (!deleted) {
      throw new AppError(
        'Análise não encontrada ou você não tem permissão para excluí-la.',
        404,
        'ANALYSIS_NOT_FOUND'
      );
    }

    return {
      message: 'Análise removida com sucesso',
      deletedId: analysisId,
    };
  }

  private formatAnalysisResponse(
    entity: Awaited<ReturnType<typeof analysisRepository.create>>,
    meta?: {
      isFallback?: boolean;
      fallbackReason?: FallbackReason;
      upstreamStatus?: number;
    }
  ) {
    return {
      id: entity.id,
      createdAt: entity.createdAt.toISOString(),
      imageThumbnail: entity.imageThumbnail,
      preferences: {
        genres: entity.prefGenres,
        language: entity.prefLanguage,
        era: entity.prefEra,
      },
      vibeSummary: entity.vibeSummary,
      moodTags: entity.moodTags,
      dominantColors: entity.dominantColors,
      isFallback: Boolean(meta?.isFallback),
      ...(meta?.fallbackReason ? { fallbackReason: meta.fallbackReason } : {}),
      ...(meta?.upstreamStatus !== undefined ? { upstreamStatus: meta.upstreamStatus } : {}),
      recommendations: entity.recommendations.map((rec) => ({
        id: rec.id,
        rankOrder: rec.rankOrder,
        title: rec.title,
        artist: rec.artist,
        albumArtUrl: rec.albumArtUrl,
        reason: rec.reason,
        previewUrl: rec.previewUrl,
        hasPreview: rec.hasPreview,
        externalUrl: rec.externalUrl,
        externalProvider: rec.externalProvider,
      })),
    };
  }
}

export const analysisService = new AnalysisService();
