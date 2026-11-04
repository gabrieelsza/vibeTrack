import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors.util';

export function errorMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    if (err.retryAfterSeconds !== undefined && err.retryAfterSeconds > 0) {
      res.setHeader('Retry-After', String(err.retryAfterSeconds));
    }

    res.status(err.statusCode).json({
      code: err.code,
      ...(err.retryAfterSeconds !== undefined
        ? { retryAfterSeconds: err.retryAfterSeconds }
        : {}),
      error: {
        code: err.code,
        message: err.message,
        ...(err.retryAfterSeconds !== undefined
          ? { retryAfterSeconds: err.retryAfterSeconds }
          : {}),
      },
    });
    return;
  }

  if (err instanceof ZodError) {
    const firstIssue = err.issues[0];
    res.status(400).json({
      code: 'VALIDATION_ERROR',
      error: {
        code: 'VALIDATION_ERROR',
        message: firstIssue?.message || 'Dados de entrada inválidos.',
        details: err.issues,
      },
    });
    return;
  }

  console.error(
    JSON.stringify({
      level: 'error',
      event: 'unhandled_server_error',
      timestamp: new Date().toISOString(),
      message: err instanceof Error ? err.message : 'Unknown error',
    })
  );

  res.status(500).json({
    code: 'INTERNAL_SERVER_ERROR',
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Ocorreu um erro interno inesperado no servidor.',
    },
  });
}
