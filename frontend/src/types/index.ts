export interface UserProfile {
  id: string;
  name: string;
  email: string;
}

export interface MusicPreferences {
  genres?: string;
  language?: string;
  era?: string;
}

export type FallbackReason =
  | 'NO_API_KEY'
  | 'RATE_LIMITED'
  | 'UPSTREAM_ERROR'
  | 'INVALID_AI_RESPONSE';

export interface MusicRecommendation {
  id: string;
  rankOrder: number;
  title: string;
  artist: string;
  albumArtUrl: string | null;
  reason: string;
  previewUrl: string | null;
  hasPreview: boolean;
  externalUrl: string;
  externalProvider: string;
  bestCut?: string | null;
}

export interface PhotoAnalysis {
  id: string;
  createdAt: string;
  imageThumbnail: string;
  preferences: {
    genres?: string | null;
    language?: string | null;
    era?: string | null;
  };
  vibeSummary: string;
  moodTags: string[];
  dominantColors: string[];
  isFallback?: boolean;
  fallbackReason?: FallbackReason;
  upstreamStatus?: number;
  recommendations: MusicRecommendation[];
}
