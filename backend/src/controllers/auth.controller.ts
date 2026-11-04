import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { authService } from '../services/auth.service';

const registerSchema = z.object({
  name: z
    .string({ required_error: 'O nome é obrigatório.' })
    .trim()
    .min(2, 'O nome deve ter pelo menos 2 caracteres.')
    .max(120, 'O nome deve ter no máximo 120 caracteres.'),
  email: z
    .string({ required_error: 'O e-mail é obrigatório.' })
    .trim()
    .email('Informe um endereço de e-mail válido.'),
  password: z
    .string({ required_error: 'A senha é obrigatória.' })
    .min(6, 'A senha deve conter no mínimo 6 caracteres.'),
});

const loginSchema = z.object({
  email: z
    .string({ required_error: 'O e-mail é obrigatório.' })
    .trim()
    .email('Informe um endereço de e-mail válido.'),
  password: z
    .string({ required_error: 'A senha é obrigatória.' })
    .min(1, 'Informe sua senha.'),
});

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const payload = registerSchema.parse(req.body);
      const result = await authService.register(payload);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const payload = loginSchema.parse(req.body);
      const result = await authService.login(payload);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const result = await authService.getMe(userId);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}

export const authController = new AuthController();
