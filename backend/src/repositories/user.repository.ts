import { randomUUID } from 'crypto';
import { getPrismaClient, isNeonConfigured } from '../config/prisma';
import { readLocalStore, writeLocalStore } from '../utils/local-store.util';

export interface UserEntity {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

export class UserRepository {
  async findByEmail(email: string): Promise<UserEntity | null> {
    const normalizedEmail = email.trim().toLowerCase();
    if (isNeonConfigured()) {
      const prisma = getPrismaClient();
      return prisma.user.findUnique({ where: { email: normalizedEmail } });
    }

    const store = readLocalStore();
    const found = store.users.find((u) => u.email.toLowerCase() === normalizedEmail);
    if (!found) return null;
    return {
      ...found,
      createdAt: new Date(found.createdAt),
      updatedAt: new Date(found.updatedAt),
    };
  }

  async findById(id: string): Promise<UserEntity | null> {
    if (isNeonConfigured()) {
      const prisma = getPrismaClient();
      return prisma.user.findUnique({ where: { id } });
    }

    const store = readLocalStore();
    const found = store.users.find((u) => u.id === id);
    if (!found) return null;
    return {
      ...found,
      createdAt: new Date(found.createdAt),
      updatedAt: new Date(found.updatedAt),
    };
  }

  async create(data: {
    name: string;
    email: string;
    passwordHash: string;
  }): Promise<UserEntity> {
    const normalizedEmail = data.email.trim().toLowerCase();
    if (isNeonConfigured()) {
      const prisma = getPrismaClient();
      return prisma.user.create({
        data: {
          name: data.name.trim(),
          email: normalizedEmail,
          passwordHash: data.passwordHash,
        },
      });
    }

    const store = readLocalStore();
    const now = new Date().toISOString();
    const newUser = {
      id: randomUUID(),
      name: data.name.trim(),
      email: normalizedEmail,
      passwordHash: data.passwordHash,
      createdAt: now,
      updatedAt: now,
    };
    store.users.push(newUser);
    writeLocalStore(store);

    return {
      ...newUser,
      createdAt: new Date(newUser.createdAt),
      updatedAt: new Date(newUser.updatedAt),
    };
  }
}

export const userRepository = new UserRepository();
