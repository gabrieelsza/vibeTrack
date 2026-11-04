import { PrismaClient } from '@prisma/client';
import { isNeonConfigured } from './env';

let prismaInstance: PrismaClient | null = null;

export function getPrismaClient(): PrismaClient {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient();
  }
  return prismaInstance;
}

export { isNeonConfigured };
