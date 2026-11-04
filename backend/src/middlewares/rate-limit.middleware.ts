import { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';
import { AppError } from '../utils/errors.util';
import { logServiceAttempt } from '../utils/resilience.util';

const requestBuckets = new Map<string, number[]>();

export function resetRateLimiter(): void {
  requestBuckets.clear();
}

function resolveMaxPerWindow(): number {
  const rawEnv = process.env.RATE_LIMIT_PER_MINUTE;
  if (rawEnv !== undefined && rawEnv.trim() !== '') {
    const parsed = Number(rawEnv);
    if (Number.isFinite(parsed)) {
      return Math.floor(parsed);
    }
  }
  return env.RATE_LIMIT_PER_MINUTE;
}

function resolveClientKey(req: Request): string {
  if (req.user?.id) {
    return `user:${req.user.id}`;
  }
  const forwarded = req.headers['x-forwarded-for'];
  const firstForwardedIp = Array.isArray(forwarded)
    ? forwarded[0]
    : typeof forwarded === 'string'
    ? forwarded.split(',')[0]?.trim()
    : undefined;

  return `ip:${firstForwardedIp || req.ip || 'anonymous'}`;
}

/**
 * Rate limit técnico por usuário autenticado (evitando bloqueio por IP de proxy compartilhado)
 * para proteger o servidor contra abuso/spam sem bloquear uso legítimo.
 * Se RATE_LIMIT_PER_MINUTE <= 0, o limitador fica desabilitado.
 */
export function analysisRateLimitMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const maxPerWindow = resolveMaxPerWindow();
  if (maxPerWindow <= 0) {
    next();
    return;
  }

  const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || env.RATE_LIMIT_WINDOW_MS || 60000);
  const clientKey = resolveClientKey(req);
  const now = Date.now();
  const windowStart = now - windowMs;

  const recentTimestamps = (requestBuckets.get(clientKey) || []).filter(
    (timestamp) => timestamp > windowStart
  );

  if (recentTimestamps.length >= maxPerWindow) {
    requestBuckets.set(clientKey, recentTimestamps);
    const oldestTimestamp = recentTimestamps[0] || now;
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((oldestTimestamp + windowMs - now) / 1000)
    );

    logServiceAttempt({
      service: 'RATE_LIMIT_GUARD',
      attempt: 1,
      maxAttempts: 1,
      status: 429,
      waitMs: retryAfterSeconds * 1000,
      retryAfterHeader: String(retryAfterSeconds),
      errorBody: `Rate limit local atingido para ${clientKey} (${recentTimestamps.length}/${maxPerWindow} em ${windowMs}ms)`,
      outcome: 'ABORTED_NON_RETRYABLE',
    });

    next(
      new AppError(
        'Calma, tente de novo em alguns segundos',
        429,
        'RATE_LIMIT_EXCEEDED',
        retryAfterSeconds
      )
    );
    return;
  }

  recentTimestamps.push(now);
  requestBuckets.set(clientKey, recentTimestamps);
  next();
}
