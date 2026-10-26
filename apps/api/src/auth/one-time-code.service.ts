import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { OneTimeCodePurpose, Prisma } from '../generated/prisma/client.js';
import { AppException } from '../common/errors/app.exception.js';
import { PrismaService } from '../prisma/prisma.service.js';

export const CODE_TTL_SECONDS = 10 * 60;
export const RESEND_COOLDOWN_SECONDS = 60;
export const MAX_ATTEMPTS = 5;

/**
 * The machinery behind every emailed 6-digit code (verify email, reset password).
 * It knows nothing about emails or passwords: it creates codes, rate-limits asking for them,
 * and checks what the user typed. Each feature supplies its own `purpose`, so a code made for
 * one purpose can never be used for another.
 */
@Injectable()
export class OneTimeCodeService {
  private readonly secret: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.secret = config.getOrThrow<string>('JWT_ACCESS_SECRET');
  }

  /** How many seconds the user must still wait before a new code may be created (0 = go ahead). */
  async cooldownLeft(userId: string, purpose: OneTimeCodePurpose): Promise<number> {
    const active = await this.prisma.oneTimeCode.findFirst({ where: { userId, purpose, consumedAt: null } });
    if (!active) return 0;
    const waited = (Date.now() - active.createdAt.getTime()) / 1000;
    return waited < RESEND_COOLDOWN_SECONDS ? Math.ceil(RESEND_COOLDOWN_SECONDS - waited) : 0;
  }

  /** Cancel the active code (e.g. the email carrying it could not be sent, so the user may ask again at once). */
  async retire(userId: string, purpose: OneTimeCodePurpose): Promise<void> {
    await this.prisma.oneTimeCode.updateMany({ where: { userId, purpose, consumedAt: null }, data: { consumedAt: new Date() } });
  }

  /** Create a new code (retiring any older one) and return it in plain text, to be emailed. */
  async issue(userId: string, purpose: OneTimeCodePurpose): Promise<string> {
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.prisma.$transaction(async (tx) => {
      // Retire the old code first; the partial unique index allows only one active code.
      await tx.oneTimeCode.updateMany({ where: { userId, purpose, consumedAt: null }, data: { consumedAt: new Date() } });
      await tx.oneTimeCode.create({
        data: { userId, purpose, codeHash: this.hash(userId, purpose, code), expiresAt: new Date(Date.now() + CODE_TTL_SECONDS * 1000) },
      });
    });
    return code;
  }

  /**
   * Check the typed code. If it is right, mark it used and run `action` in the SAME database
   * transaction, so "code used" and "what the code unlocks" succeed or fail together.
   * Throws INVALID_CODE / CODE_EXPIRED / CODE_LOCKED otherwise.
   */
  async verifyAndRun<T>(
    userId: string,
    purpose: OneTimeCodePurpose,
    code: string,
    action: (tx: Prisma.TransactionClient) => Promise<T>,
    options: { showAttemptsLeft?: boolean } = {},
  ): Promise<T> {
    const { showAttemptsLeft = true } = options;
    const active = await this.prisma.oneTimeCode.findFirst({ where: { userId, purpose, consumedAt: null } });
    if (!active) throw new AppException(400, 'INVALID_CODE', 'That code is not valid. Request a new one.');
    if (active.expiresAt.getTime() <= Date.now()) {
      throw new AppException(400, 'CODE_EXPIRED', 'That code has expired. Request a new one.');
    }
    if (active.attempts >= MAX_ATTEMPTS) {
      throw new AppException(400, 'CODE_LOCKED', 'Too many wrong attempts. Request a new code.');
    }

    if (!this.matches(this.hash(userId, purpose, code), active.codeHash)) {
      // Count the wrong guess atomically so parallel guesses cannot sneak past the limit.
      const updated = await this.prisma.oneTimeCode.update({ where: { id: active.id }, data: { attempts: { increment: 1 } } });
      const attemptsLeft = Math.max(0, MAX_ATTEMPTS - updated.attempts);
      if (attemptsLeft === 0) throw new AppException(400, 'CODE_LOCKED', 'Too many wrong attempts. Request a new code.');
      throw new AppException(400, 'INVALID_CODE', 'That code is not correct.', showAttemptsLeft ? { attemptsLeft } : {});
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.oneTimeCode.update({ where: { id: active.id }, data: { consumedAt: new Date() } });
      return action(tx);
    });
  }

  /**
   * HMAC = a hash that needs our secret. A 6-digit code has only a million possibilities, so a
   * plain hash could be reversed instantly if the database leaked; this one cannot without the secret.
   */
  private hash(userId: string, purpose: OneTimeCodePurpose, code: string): string {
    return createHmac('sha256', this.secret).update(`${purpose}:${userId}:${code}`).digest('hex');
  }

  private matches(a: string, b: string): boolean {
    return a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
  }
}
