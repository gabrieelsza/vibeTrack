import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AuthTokenPayload } from '../services/auth.service';
import { AppError } from '../utils/errors.util';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        name: string;
      };
    }
  }
}

export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next(
      new AppError(
        'Autenticação obrigatória. Faça login na sua conta para continuar.',
        401,
        'UNAUTHORIZED'
      )
    );
    return;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as AuthTokenPayload;
    req.user = {
      id: decoded.sub,
      email: decoded.email,
      name: decoded.name,
    };
    next();
  } catch {
    next(
      new AppError(
        'Sessão expirada ou token inválido. Faça login novamente.',
        401,
        'INVALID_TOKEN'
      )
    );
  }
}
