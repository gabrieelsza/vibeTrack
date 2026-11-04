import { randomUUID } from 'crypto';
import { getPrismaClient, isNeonConfigured } from '../config/prisma';
import { readLocalStore, writeLocalStore } from '../utils/local-store.util';

export interface RecommendationInput {
  rankOrder: number;
  title: string;
  artist: string;
  albumArtUrl: string | null;
  reason: string;
  previewUrl: string | null;
  hasPreview: boolean;
  externalUrl: string;
  externalProvider: string;
}

export interface CreateAnalysisRecordInput {
  userId: string;
  imageThumbnail: string;
  prefGenres?: string | null;
  prefLanguage?: string | null;
  prefEra?: string | null;
  vibeSummary: string;
  moodTags: string[];
  dominantColors: string[];
  recommendations: RecommendationInput[];
}

export interface AnalysisWithRecommendations {
  id: string;
  userId: string;
  imageThumbnail: string;
  prefGenres: string | null;
  prefLanguage: string | null;
  prefEra: string | null;
  vibeSummary: string;
  moodTags: string[];
  dominantColors: string[];
  createdAt: Date;
  recommendations: {
    id: string;
    analysisId: string;
    rankOrder: number;
    title: string;
    artist: string;
    albumArtUrl: string | null;
    reason: string;
    previewUrl: string | null;
    hasPreview: boolean;
    externalUrl: string;
    externalProvider: string;
  }[];
}

export class AnalysisRepository {
  /**
   * Salva a análise e suas recomendações musicais no histórico do usuário.
   */
  async create(input: CreateAnalysisRecordInput): Promise<AnalysisWithRecommendations> {
    if (isNeonConfigured()) {
      const prisma = getPrismaClient();
      return prisma.photoAnalysis.create({
        data: {
          userId: input.userId,
          imageThumbnail: input.imageThumbnail,
          prefGenres: input.prefGenres ?? null,
          prefLanguage: input.prefLanguage ?? null,
          prefEra: input.prefEra ?? null,
          vibeSummary: input.vibeSummary,
          moodTags: input.moodTags,
          dominantColors: input.dominantColors,
          recommendations: {
            create: input.recommendations.map((rec) => ({
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
          },
        },
        include: {
          recommendations: {
            orderBy: { rankOrder: 'asc' },
          },
        },
      });
    }

    const store = readLocalStore();
    const user = store.users.find((u) => u.id === input.userId);
    if (!user) {
      throw new Error('Usuário não encontrado para salvar a análise');
    }

    const analysisId = randomUUID();
    const nowIso = new Date().toISOString();
    const storedRecommendations = input.recommendations
      .slice()
      .sort((a, b) => a.rankOrder - b.rankOrder)
      .map((rec) => ({
        id: randomUUID(),
        analysisId,
        rankOrder: rec.rankOrder,
        title: rec.title,
        artist: rec.artist,
        albumArtUrl: rec.albumArtUrl,
        reason: rec.reason,
        previewUrl: rec.previewUrl,
        hasPreview: rec.hasPreview,
        externalUrl: rec.externalUrl,
        externalProvider: rec.externalProvider,
      }));

    const storedAnalysis = {
      id: analysisId,
      userId: input.userId,
      imageThumbnail: input.imageThumbnail,
      prefGenres: input.prefGenres ?? null,
      prefLanguage: input.prefLanguage ?? null,
      prefEra: input.prefEra ?? null,
      vibeSummary: input.vibeSummary,
      moodTags: input.moodTags,
      dominantColors: input.dominantColors,
      createdAt: nowIso,
      recommendations: storedRecommendations,
    };

    user.updatedAt = nowIso;
    store.analyses.unshift(storedAnalysis);
    writeLocalStore(store);

    return {
      ...storedAnalysis,
      createdAt: new Date(storedAnalysis.createdAt),
    };
  }

  async findAllByUserId(userId: string): Promise<AnalysisWithRecommendations[]> {
    if (isNeonConfigured()) {
      const prisma = getPrismaClient();
      return prisma.photoAnalysis.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        include: {
          recommendations: {
            orderBy: { rankOrder: 'asc' },
          },
        },
      });
    }

    const store = readLocalStore();
    return store.analyses
      .filter((a) => a.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((a) => ({
        ...a,
        createdAt: new Date(a.createdAt),
        recommendations: a.recommendations
          .slice()
          .sort((r1, r2) => r1.rankOrder - r2.rankOrder),
      }));
  }

  async findByIdAndUserId(
    analysisId: string,
    userId: string
  ): Promise<AnalysisWithRecommendations | null> {
    if (isNeonConfigured()) {
      const prisma = getPrismaClient();
      return prisma.photoAnalysis.findFirst({
        where: { id: analysisId, userId },
        include: {
          recommendations: {
            orderBy: { rankOrder: 'asc' },
          },
        },
      });
    }

    const store = readLocalStore();
    const found = store.analyses.find((a) => a.id === analysisId && a.userId === userId);
    if (!found) return null;
    return {
      ...found,
      createdAt: new Date(found.createdAt),
      recommendations: found.recommendations
        .slice()
        .sort((r1, r2) => r1.rankOrder - r2.rankOrder),
    };
  }

  async deleteByIdAndUserId(analysisId: string, userId: string): Promise<boolean> {
    if (isNeonConfigured()) {
      const prisma = getPrismaClient();
      const existing = await prisma.photoAnalysis.findFirst({
        where: { id: analysisId, userId },
      });
      if (!existing) return false;
      await prisma.photoAnalysis.delete({ where: { id: analysisId } });
      return true;
    }

    const store = readLocalStore();
    const index = store.analyses.findIndex((a) => a.id === analysisId && a.userId === userId);
    if (index === -1) return false;
    store.analyses.splice(index, 1);
    writeLocalStore(store);
    return true;
  }
}

export const analysisRepository = new AnalysisRepository();
