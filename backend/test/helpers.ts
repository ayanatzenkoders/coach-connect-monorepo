import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import type { Role } from '../src/generated/prisma/client.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

export const PASSWORD = 'Password123!';

export async function createApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.init();
  return app;
}

export async function resetDb(prisma: PrismaService) {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE audit_log, push_tokens, blocks, subscriptions, coach_profiles, sessions, users CASCADE');
}

/** Insert a user straight into the database (staff and coaches cannot self-register). */
export async function seedUser(prisma: PrismaService, email: string, role: Role, name = email.split('@')[0]!) {
  return prisma.user.create({
    data: {
      email,
      name,
      role,
      passwordHash: await argon2.hash(PASSWORD, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 }),
    },
  });
}

export const api = (app: INestApplication) => request(app.getHttpServer());

export const login = (app: INestApplication, email: string, deviceId = 'device-aaaaaaaa', path = '/auth/login') =>
  api(app).post(path).send({ email, password: PASSWORD, deviceId });

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
