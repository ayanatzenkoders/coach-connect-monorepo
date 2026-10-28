import { Injectable, Logger } from '@nestjs/common';
import { AppException } from '../common/errors/app.exception.js';
import { MailerService } from '../mail/mailer.service.js';
import { verifyEmailEmail } from '../mail/templates.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CODE_TTL_SECONDS, VerificationCodeService, RESEND_COOLDOWN_SECONDS } from './verification-code.service.js';

const PURPOSE = 'EMAIL_VERIFICATION' as const;

/** Proves a user owns their email address with a 6-digit code (design "04 Verify email"). */
@Injectable()
export class EmailVerificationService {
  private readonly log = new Logger(EmailVerificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService,
    private readonly codes: VerificationCodeService,
  ) {}

  /** Create a new code and email it. Replaces any older active code. */
  async sendCode(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.emailVerifiedAt) throw new AppException(409, 'ALREADY_VERIFIED', 'Your email is already verified.');

    // Anti-spam: one email per minute per user (stops "resend" being used to flood an inbox).
    const retryAfterSeconds = await this.codes.cooldownLeft(userId, PURPOSE);
    if (retryAfterSeconds > 0) {
      throw new AppException(429, 'CODE_COOLDOWN', 'A code was just sent. Please wait a moment.', { retryAfterSeconds });
    }

    const code = await this.codes.issue(userId, PURPOSE);
    try {
      await this.mailer.send({
        to: user.email,
        ...verifyEmailEmail(code, CODE_TTL_SECONDS / 60),
      });
    } catch (e) {
      this.log.error(`Could not send the verification email: ${e instanceof Error ? e.message : String(e)}`);
      await this.codes.retire(userId, PURPOSE); // so "Resend" works immediately instead of waiting a minute
      throw new AppException(503, 'EMAIL_SEND_FAILED', 'We could not send the email right now. Please try again in a moment.');
    }
    return { expiresInSeconds: CODE_TTL_SECONDS, resendAfterSeconds: RESEND_COOLDOWN_SECONDS };
  }

  /** Check the code the user typed. */
  async verify(userId: string, code: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.emailVerifiedAt) return { emailVerified: true }; // already done: harmless to repeat

    await this.codes.verifyAndRun(userId, PURPOSE, code, (tx) =>
      tx.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } }),
    );
    return { emailVerified: true };
  }
}
