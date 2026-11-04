import dotenv from 'dotenv';

dotenv.config();

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function parseNonNegativeInt(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}

export const env = {
  PORT: parsePositiveInt(process.env.PORT, 8550),
  DATABASE_URL: process.env.DATABASE_URL || "",
  JWT_SECRET: process.env.JWT_SECRET || 'vibetrack-super-secret-jwt-key-dev',
  GEMINI_API_KEY: (process.env.GEMINI_API_KEY || '').trim(),
  GEMINI_MODEL: (process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite').trim(),
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
  NODE_ENV: (process.env.NODE_ENV || 'development').trim(),
  RATE_LIMIT_PER_MINUTE: parseNonNegativeInt(process.env.RATE_LIMIT_PER_MINUTE, 30),
  RATE_LIMIT_WINDOW_MS: parsePositiveInt(process.env.RATE_LIMIT_WINDOW_MS, 60000),
  MAX_CONCURRENT_AI: parsePositiveInt(process.env.MAX_CONCURRENT_AI, 2),
  MAX_CONCURRENT_MUSIC: parsePositiveInt(process.env.MAX_CONCURRENT_MUSIC, 2),
  MAX_RETRIES: parseNonNegativeInt(process.env.MAX_RETRIES, 3),
  CACHE_TTL_SECONDS: parsePositiveInt(process.env.CACHE_TTL_SECONDS, 14400),
  AI_CACHE_TTL_MS: parsePositiveInt(
    process.env.AI_CACHE_TTL_MS,
    parsePositiveInt(process.env.CACHE_TTL_SECONDS, 14400) * 1000
  ),
  SIMULATE_429_MODE: (process.env.SIMULATE_429_MODE || 'none').trim().toLowerCase(),
};

export function isProductionEnv(): boolean {
  return (process.env.NODE_ENV || env.NODE_ENV).trim().toLowerCase() === 'production';
}

export function getGeminiModel(): string {
  return (process.env.GEMINI_MODEL || env.GEMINI_MODEL || 'gemini-3.1-flash-lite').trim();
}

export function getCacheTtlMs(): number {
  if (process.env.CACHE_TTL_SECONDS && Number(process.env.CACHE_TTL_SECONDS) > 0) {
    return Number(process.env.CACHE_TTL_SECONDS) * 1000;
  }
  if (process.env.AI_CACHE_TTL_MS && Number(process.env.AI_CACHE_TTL_MS) > 0) {
    return Number(process.env.AI_CACHE_TTL_MS);
  }
  return env.CACHE_TTL_SECONDS * 1000;
}

export function isNeonConfigured(): boolean {
  const url = env.DATABASE_URL.trim();
  return (
    url.startsWith('postgres') &&
    !url.includes('ep-exemplo.us-east-2.aws.neon.tech') &&
    !url.includes('usuario:senha@')
  );
}
