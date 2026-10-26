import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppException } from '../common/errors/app.exception.js';
import { MailerService } from '../mail/mailer.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

export const CODE_TTL_SECONDS = 10 * 60;
export const RESEND_COOLDOWN_SECONDS = 60;
export const MAX_ATTEMPTS = 5;
const PURPOSE = 'EMAIL_VERIFICATION' as const;

/** Proves a user owns their email address with a 6-digit code (design "04 Verify email"). */
@Injectable()
export class EmailVerificationService {
  private readonly secret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService,
    config: ConfigService,
  ) {
    this.secret = config.getOrThrow<string>('JWT_ACCESS_SECRET');
  }

  /** Create a new code and email it. Replaces any older active code. */
  async sendCode(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.emailVerifiedAt) throw new AppException(409, 'ALREADY_VERIFIED', 'Your email is already verified.');

    // Anti-spam: one email per minute per user (stops "resend" being used to flood an inbox).
    const active = await this.prisma.oneTimeCode.findFirst({ where: { userId, purpose: PURPOSE, consumedAt: null } });
    if (active) {
      const waited = (Date.now() - active.createdAt.getTime()) / 1000;
      if (waited < RESEND_COOLDOWN_SECONDS) {
        const retryAfterSeconds = Math.ceil(RESEND_COOLDOWN_SECONDS - waited);
        throw new AppException(429, 'CODE_COOLDOWN', 'A code was just sent. Please wait a moment.', { retryAfterSeconds });
      }
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.prisma.$transaction(async (tx) => {
      // Retire the old code first; the partial unique index allows only one active code.
      await tx.oneTimeCode.updateMany({
        where: { userId, purpose: PURPOSE, consumedAt: null },
        data: { consumedAt: new Date() },
      });
      await tx.oneTimeCode.create({
        data: { userId, purpose: PURPOSE, codeHash: this.hash(userId, code), expiresAt: new Date(Date.now() + CODE_TTL_SECONDS * 1000) },
      });
    });

    await this.mailer.send({
      to: user.email,
      subject: 'Your Coach Connect verification code',
      text: `Your verification code is ${code}\nIt expires in ${CODE_TTL_SECONDS / 60} minutes. If you did not sign up, ignore this email.`,
    });
    return { expiresInSeconds: CODE_TTL_SECONDS, resendAfterSeconds: RESEND_COOLDOWN_SECONDS };
  }

  /** Check the code the user typed. */
  async verify(userId: string, code: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.emailVerifiedAt) return { emailVerified: true }; // already done: harmless to repeat

    const active = await this.prisma.oneTimeCode.findFirst({ where: { userId, purpose: PURPOSE, consumedAt: null } });
    if (!active) throw new AppException(400, 'INVALID_CODE', 'That code is not valid. Request a new one.');
    if (active.expiresAt.getTime() <= Date.now()) {
      throw new AppException(400, 'CODE_EXPIRED', 'That code has expired. Request a new one.');
    }
    if (active.attempts >= MAX_ATTEMPTS) {
      throw new AppException(400, 'CODE_LOCKED', 'Too many wrong attempts. Request a new code.');
    }

    if (!this.matches(this.hash(userId, code), active.codeHash)) {
      // Count the wrong guess atomically so parallel guesses cannot sneak past the limit.
      const updated = await this.prisma.oneTimeCode.update({ where: { id: active.id }, data: { attempts: { increment: 1 } } });
      const attemptsLeft = Math.max(0, MAX_ATTEMPTS - updated.attempts);
      if (attemptsLeft === 0) throw new AppException(400, 'CODE_LOCKED', 'Too many wrong attempts. Request a new code.');
      throw new AppException(400, 'INVALID_CODE', 'That code is not correct.', { attemptsLeft });
    }

    await this.prisma.$transaction([
      this.prisma.oneTimeCode.update({ where: { id: active.id }, data: { consumedAt: new Date() } }),
      this.prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } }),
    ]);
    return { emailVerified: true };
  }

  /**
   * HMAC = a hash that needs our secret. A 6-digit code has only a million possibilities, so a
   * plain hash could be reversed instantly if the database leaked; this one cannot without the secret.
   */
  private hash(userId: string, code: string): string {
    return createHmac('sha256', this.secret).update(`${PURPOSE}:${userId}:${code}`).digest('hex');
  }

  private matches(a: string, b: string): boolean {
    return a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
  }
}
