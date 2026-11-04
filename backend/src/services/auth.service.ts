import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { userRepository } from '../repositories/user.repository';
import { AppError } from '../utils/errors.util';

export interface AuthTokenPayload {
  sub: string;
  email: string;
  name: string;
}

export class AuthService {
  private signToken(payload: AuthTokenPayload): string {
    return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '7d' });
  }

  async register(input: { name: string; email: string; password: string }) {
    const existing = await userRepository.findByEmail(input.email);
    if (existing) {
      throw new AppError(
        'Este endereço de e-mail já está cadastrado. Faça login ou use outro e-mail.',
        409,
        'EMAIL_ALREADY_EXISTS'
      );
    }

    const passwordHash = await bcrypt.hash(input.password, 10);
    const user = await userRepository.create({
      name: input.name,
      email: input.email,
      passwordHash,
    });

    const token = this.signToken({
      sub: user.id,
      email: user.email,
      name: user.name,
    });

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    };
  }

  async login(input: { email: string; password: string }) {
    const user = await userRepository.findByEmail(input.email);
    if (!user) {
      throw new AppError('E-mail ou senha inválidos.', 401, 'INVALID_CREDENTIALS');
    }

    const passwordMatches = await bcrypt.compare(input.password, user.passwordHash);
    if (!passwordMatches) {
      throw new AppError('E-mail ou senha inválidos.', 401, 'INVALID_CREDENTIALS');
    }

    const token = this.signToken({
      sub: user.id,
      email: user.email,
      name: user.name,
    });

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    };
  }

  async getMe(userId: string) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new AppError('Sessão inválida ou usuário não encontrado.', 401, 'UNAUTHORIZED');
    }

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    };
  }
}

export const authService = new AuthService();
