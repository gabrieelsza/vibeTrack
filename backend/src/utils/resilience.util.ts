import { env, getCacheTtlMs } from '../config/env';
import { AppError, ServiceBusyError } from './errors.util';

export type ExternalServiceName = 'AI_VISION' | 'MUSIC_CATALOG' | 'RATE_LIMIT_GUARD';

export type FallbackReason =
  | 'NO_API_KEY'
  | 'RATE_LIMITED'
  | 'UPSTREAM_ERROR'
  | 'INVALID_AI_RESPONSE';

export interface StructuredAttemptLog {
  timestamp: string;
  service: ExternalServiceName;
  attempt: number;
  maxAttempts: number;
  status: number | string;
  waitMs: number;
  retryAfterHeader?: string | null;
  errorBody?: string;
  fallbackReason?: FallbackReason;
  outcome: 'SUCCESS' | 'RETRY_SCHEDULED' | 'ABORTED_NON_RETRYABLE' | 'EXHAUSTED_BUSY' | 'FALLBACK';
}

const recentLogs: StructuredAttemptLog[] = [];
const MAX_RECENT_LOGS = 100;

export function logServiceAttempt(entry: Omit<StructuredAttemptLog, 'timestamp'>): void {
  const fullEntry: StructuredAttemptLog = {
    timestamp: new Date().toISOString(),
    ...entry,
  };

  recentLogs.push(fullEntry);
  if (recentLogs.length > MAX_RECENT_LOGS) {
    recentLogs.shift();
  }

  const level =
    entry.outcome === 'SUCCESS'
      ? 'info'
      : entry.outcome === 'FALLBACK' || entry.outcome === 'EXHAUSTED_BUSY'
      ? 'error'
      : 'warn';

  const logLine = JSON.stringify({
    level,
    event: 'external_service_attempt',
    ...fullEntry,
  });

  if (level === 'info') {
    console.info(logLine);
  } else if (level === 'error') {
    console.error(logLine);
  } else {
    console.warn(logLine);
  }
}

export function getRecentResilienceLogs(): StructuredAttemptLog[] {
  return [...recentLogs];
}

export function clearResilienceLogs(): void {
  recentLogs.length = 0;
}

/**
 * Erro representando uma resposta HTTP ou falha de serviço externo (IA ou Música),
 * preservando status, header Retry-After e corpo do erro para diagnóstico e backoff.
 */
export class UpstreamServiceError extends Error {
  public readonly service: ExternalServiceName;
  public readonly status: number;
  public readonly retryAfterHeader: string | null;
  public readonly errorBody: string;

  constructor(params: {
    service: ExternalServiceName;
    status: number;
    message: string;
    retryAfterHeader?: string | null;
    errorBody?: string;
  }) {
    super(params.message);
    this.service = params.service;
    this.status = params.status;
    this.retryAfterHeader = params.retryAfterHeader ?? null;
    this.errorBody = (params.errorBody || params.message).slice(0, 500);
    Object.setPrototypeOf(this, UpstreamServiceError.prototype);
  }
}

/**
 * Interpreta o header HTTP Retry-After (em segundos inteiros ou data HTTP RFC 7231).
 */
export function parseRetryAfterMs(retryAfterHeader?: string | null): number | null {
  if (!retryAfterHeader) return null;
  const trimmed = retryAfterHeader.trim();
  if (!trimmed) return null;

  const seconds = Number(trimmed);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.round(seconds * 1000);
  }

  const dateMs = Date.parse(trimmed);
  if (!Number.isNaN(dateMs)) {
    const deltaMs = dateMs - Date.now();
    return deltaMs > 0 ? deltaMs : 0;
  }

  return null;
}

/**
 * Retenta SOMENTE em 429 (Too Many Requests) e 5xx (erros de servidor/gateway),
 * nunca em 4xx de validação/autenticação (400, 401, 403, 404, 422).
 */
export function isRetryableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status <= 599);
}

/**
 * Extrai status HTTP, Retry-After e corpo de erro de exceções diversas (SDK Google GenAI, fetch, etc.).
 */
export function extractUpstreamErrorDetails(
  err: unknown,
  service: ExternalServiceName
): {
  status: number;
  retryAfterHeader: string | null;
  errorBody: string;
} {
  if (err instanceof UpstreamServiceError) {
    return {
      status: err.status,
      retryAfterHeader: err.retryAfterHeader,
      errorBody: err.errorBody,
    };
  }

  if (err instanceof AppError) {
    return {
      status: err.statusCode,
      retryAfterHeader: err.retryAfterSeconds ? String(err.retryAfterSeconds) : null,
      errorBody: err.message,
    };
  }

  const anyErr = err as Record<string, unknown> | null;
  const rawMessage = err instanceof Error ? err.message : String(err || 'Unknown error');

  let status =
    typeof anyErr?.status === 'number'
      ? anyErr.status
      : typeof anyErr?.statusCode === 'number'
      ? anyErr.statusCode
      : 0;

  if (!status) {
    if (/\b429\b|RESOURCE_EXHAUSTED|Too Many Requests|quota|rate limit/i.test(rawMessage)) {
      status = 429;
    } else if (/\b404\b|NOT_FOUND|no longer available/i.test(rawMessage)) {
      status = 404;
    } else if (/\b401\b|\b403\b|PERMISSION_DENIED|API_KEY_INVALID|UNAUTHENTICATED/i.test(rawMessage)) {
      status = 403;
    } else if (/\b400\b|INVALID_ARGUMENT/i.test(rawMessage)) {
      status = 400;
    } else if (/\b503\b|UNAVAILABLE|overloaded/i.test(rawMessage)) {
      status = 503;
    } else if (/\b502\b|Bad Gateway/i.test(rawMessage)) {
      status = 502;
    } else if (/\b504\b|Gateway Timeout|AbortError|timed out/i.test(rawMessage)) {
      status = 504;
    } else {
      status = 502;
    }
  }

  let retryAfterHeader: string | null = null;
  const headers = anyErr?.headers as Record<string, string> | { get?: (k: string) => string | null } | undefined;
  if (headers) {
    if (typeof (headers as { get?: (k: string) => string | null }).get === 'function') {
      retryAfterHeader = (headers as { get: (k: string) => string | null }).get('retry-after');
    } else if (typeof headers === 'object') {
      retryAfterHeader =
        (headers as Record<string, string>)['retry-after'] ||
        (headers as Record<string, string>)['Retry-After'] ||
        null;
    }
  }

  if (!retryAfterHeader) {
    const retryMatch = rawMessage.match(/retry(?:\s+in|Delay"?\s*:\s*"?)?\s*(\d+(?:\.\d+)?)s/i);
    if (retryMatch) {
      retryAfterHeader = String(Math.ceil(Number(retryMatch[1])));
    }
  }

  return {
    status,
    retryAfterHeader,
    errorBody: `[${service}] ${rawMessage}`.slice(0, 500),
  };
}

export interface RetryOptions {
  service: ExternalServiceName;
  maxRetries?: number;
  baseDelayMs?: number;
  maxTotalWaitMs?: number;
  jitterMs?: number;
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetryWithBackoff<T>(
  options: RetryOptions,
  operation: (attempt: number) => Promise<T>
): Promise<T> {
  const maxRetries =
    options.maxRetries ??
    (process.env.MAX_RETRIES !== undefined ? Number(process.env.MAX_RETRIES) : env.MAX_RETRIES);
  const baseDelayMs =
    options.baseDelayMs ??
    (process.env.RETRY_BASE_DELAY_MS ? Number(process.env.RETRY_BASE_DELAY_MS) : 1000);
  const maxTotalWaitMs =
    options.maxTotalWaitMs ??
    (process.env.MAX_RETRY_TOTAL_MS ? Number(process.env.MAX_RETRY_TOTAL_MS) : 15000);
  const jitterMax = options.jitterMs ?? 250;

  const maxAttempts = Math.max(1, maxRetries + 1);
  let totalWaitedMs = 0;
  let lastRetryAfterSec = 5;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await operation(attempt);
      logServiceAttempt({
        service: options.service,
        attempt,
        maxAttempts,
        status: 200,
        waitMs: 0,
        outcome: 'SUCCESS',
      });
      return result;
    } catch (err) {
      const { status, retryAfterHeader, errorBody } = extractUpstreamErrorDetails(
        err,
        options.service
      );

      const parsedRetryAfterMs = parseRetryAfterMs(retryAfterHeader);
      if (parsedRetryAfterMs !== null && parsedRetryAfterMs > 0) {
        lastRetryAfterSec = Math.max(1, Math.ceil(parsedRetryAfterMs / 1000));
      }

      // Nunca retenta em erros 4xx de validação/autenticação/404 (exceto 429)
      if (!isRetryableStatus(status)) {
        logServiceAttempt({
          service: options.service,
          attempt,
          maxAttempts,
          status,
          waitMs: 0,
          retryAfterHeader,
          errorBody,
          outcome: 'ABORTED_NON_RETRYABLE',
        });
        throw err;
      }

      const isLastAttempt = attempt >= maxAttempts;
      const exponentialMs = baseDelayMs * Math.pow(2, attempt - 1);
      const jitter = jitterMax > 0 ? Math.floor(Math.random() * jitterMax) : 0;
      const rawWaitMs =
        parsedRetryAfterMs !== null ? parsedRetryAfterMs : exponentialMs + jitter;

      const remainingBudgetMs = maxTotalWaitMs - totalWaitedMs;
      if (isLastAttempt || remainingBudgetMs <= 0) {
        const suggestedCooldownSec =
          parsedRetryAfterMs !== null
            ? Math.max(1, Math.ceil(parsedRetryAfterMs / 1000))
            : lastRetryAfterSec;

        logServiceAttempt({
          service: options.service,
          attempt,
          maxAttempts,
          status,
          waitMs: 0,
          retryAfterHeader,
          errorBody,
          outcome: 'EXHAUSTED_BUSY',
        });

        throw new ServiceBusyError(suggestedCooldownSec);
      }

      const effectiveWaitMs = Math.min(rawWaitMs, remainingBudgetMs);
      totalWaitedMs += effectiveWaitMs;

      logServiceAttempt({
        service: options.service,
        attempt,
        maxAttempts,
        status,
        waitMs: effectiveWaitMs,
        retryAfterHeader,
        errorBody,
        outcome: 'RETRY_SCHEDULED',
      });

      await sleep(effectiveWaitMs);
    }
  }

  throw new ServiceBusyError(lastRetryAfterSec);
}

export class ConcurrencyQueue {
  private activeCount = 0;
  private readonly waitQueue: Array<() => void> = [];

  constructor(
    private readonly name: ExternalServiceName,
    private readonly getMaxConcurrency: () => number
  ) {}

  public getStats() {
    return {
      service: this.name,
      active: this.activeCount,
      queued: this.waitQueue.length,
      maxConcurrency: this.resolveLimit(),
    };
  }

  private resolveLimit(): number {
    const val = this.getMaxConcurrency();
    return Number.isFinite(val) && val > 0 ? Math.floor(val) : 2;
  }

  public async run<T>(task: () => Promise<T>): Promise<T> {
    const limit = this.resolveLimit();

    if (this.activeCount >= limit) {
      await new Promise<void>((resolve) => {
        this.waitQueue.push(resolve);
      });
    }

    this.activeCount++;
    try {
      return await task();
    } finally {
      this.activeCount--;
      const next = this.waitQueue.shift();
      if (next) {
        next();
      }
    }
  }
}

export const aiConcurrencyQueue = new ConcurrencyQueue('AI_VISION', () =>
  Number(process.env.MAX_CONCURRENT_AI || env.MAX_CONCURRENT_AI || 2)
);

export const musicConcurrencyQueue = new ConcurrencyQueue('MUSIC_CATALOG', () =>
  Number(process.env.MAX_CONCURRENT_MUSIC || env.MAX_CONCURRENT_MUSIC || 2)
);

export class TtlCache<V> {
  private readonly store = new Map<string, { value: V; expiresAt: number }>();

  public get(key: string): V | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  public set(key: string, value: V, customTtlMs?: number): void {
    const ttlMs = customTtlMs ?? getCacheTtlMs();
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  public clear(): void {
    this.store.clear();
  }

  public size(): number {
    return this.store.size;
  }
}
