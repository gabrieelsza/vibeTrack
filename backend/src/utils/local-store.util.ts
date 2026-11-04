import fs from 'fs';
import path from 'path';

export interface StoredUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoredRecommendation {
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
}

export interface StoredAnalysis {
  id: string;
  userId: string;
  imageThumbnail: string;
  prefGenres: string | null;
  prefLanguage: string | null;
  prefEra: string | null;
  vibeSummary: string;
  moodTags: string[];
  dominantColors: string[];
  createdAt: string;
  recommendations: StoredRecommendation[];
}

interface LocalDatabaseSchema {
  users: StoredUser[];
  analyses: StoredAnalysis[];
}

const DATA_DIR = path.resolve(__dirname, '../../data');
const STORE_PATH =
  process.env.NODE_ENV === 'test'
    ? path.join(DATA_DIR, 'test-store.json')
    : path.join(DATA_DIR, 'dev-store.json');

let memoryStore: LocalDatabaseSchema | null = null;

function ensureStoreLoaded(): LocalDatabaseSchema {
  if (memoryStore) return memoryStore;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, 'utf-8');
      memoryStore = JSON.parse(raw) as LocalDatabaseSchema;
      return memoryStore;
    }
  } catch {
    // Fallback to empty structure
  }
  memoryStore = { users: [], analyses: [] };
  return memoryStore;
}

export function readLocalStore(): LocalDatabaseSchema {
  return ensureStoreLoaded();
}

export function writeLocalStore(data: LocalDatabaseSchema): void {
  memoryStore = data;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch {
    // Ignore write failure in read-only environments
  }
}

export function resetLocalStore(): void {
  memoryStore = { users: [], analyses: [] };
  writeLocalStore(memoryStore);
}
