import { PhotoAnalysis } from '../types';

function getCacheKey(userId: string): string {
  return `vibetrack_offline_history_${userId}`;
}

export const offlineCacheService = {
  saveAnalyses(userId: string, analyses: PhotoAnalysis[]): void {
    try {
      localStorage.setItem(getCacheKey(userId), JSON.stringify(analyses));
    } catch {
      // Caso o storage local esteja cheio, mantém apenas os 10 mais recentes
      try {
        localStorage.setItem(getCacheKey(userId), JSON.stringify(analyses.slice(0, 10)));
      } catch {
        // Ignora erro de capacidade de armazenamento local
      }
    }
  },

  loadAnalyses(userId: string): PhotoAnalysis[] {
    try {
      const raw = localStorage.getItem(getCacheKey(userId));
      if (!raw) return [];
      return JSON.parse(raw) as PhotoAnalysis[];
    } catch {
      return [];
    }
  },

  prependAnalysis(userId: string, analysis: PhotoAnalysis): PhotoAnalysis[] {
    const current = this.loadAnalyses(userId).filter((a) => a.id !== analysis.id);
    const updated = [analysis, ...current];
    this.saveAnalyses(userId, updated);
    return updated;
  },

  removeAnalysis(userId: string, analysisId: string): PhotoAnalysis[] {
    const current = this.loadAnalyses(userId);
    const updated = current.filter((a) => a.id !== analysisId);
    this.saveAnalyses(userId, updated);
    return updated;
  },
};
