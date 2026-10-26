import { Injectable, Logger } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { AppException } from '../common/errors/app.exception.js';
import { MailerService } from '../mail/mailer.service.js';
import { passwordResetEmail } from '../mail/templates.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CODE_TTL_SECONDS, OneTimeCodeService, RESEND_COOLDOWN_SECONDS } from './one-time-code.service.js';
import { PasswordService } from './password.service.js';
import { TokenService } from './token.service.js';

const PURPOSE = 'PASSWORD_RESET' as const;

/**
 * "Forgot password" in three steps, one per mobile screen:
 *   1. requestCode  (email)        -> emails a 6-digit code
 *   2. verifyCode   (email + code) -> checks the code, hands back a short-lived reset token
 *   3. reset        (token + new password) -> changes the password, signs out every device
 */
@Injectable()
export class PasswordResetService {
  private readonly log = new Logger(PasswordResetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly codes: OneTimeCodeService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly mailer: MailerService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Step 1. Product decision: an unknown email gets a clear "no account, create one" answer
   * (404 ACCOUNT_NOT_FOUND) instead of a silent success. Trade-off: this lets someone test
   * whether an email is registered. Sign-up already reveals that ("email taken"), and every route
   * here is rate limited, so we accept it. Only app users (members, coaches) count; staff
   * accounts do not reset through the app.
   */
  async requestCode(email: string) {
    const user = await this.findAppUser(email);
    if (!user) throw this.accountNotFound();

    // A code was sent less than a minute ago: do not email again, just report the real wait.
    const wait = await this.codes.cooldownLeft(user.id, PURPOSE);
    if (wait > 0) return { expiresInSeconds: CODE_TTL_SECONDS, resendAfterSeconds: wait };

    const code = await this.codes.issue(user.id, PURPOSE);
    try {
      await this.mailer.send({
        to: user.email,
        ...passwordResetEmail(code, CODE_TTL_SECONDS / 60),
      });
    } catch (e) {
      this.log.error(`Could not send the reset email: ${e instanceof Error ? e.message : String(e)}`);
      await this.codes.retire(user.id, PURPOSE); // so the user can try again straight away
      throw new AppException(503, 'EMAIL_SEND_FAILED', 'We could not send the email right now. Please try again in a moment.');
    }
    return { expiresInSeconds: CODE_TTL_SECONDS, resendAfterSeconds: RESEND_COOLDOWN_SECONDS };
  }

  /** Step 2. A right code is used up and exchanged for a reset token (valid 10 minutes, usable once). */
  async verifyCode(email: string, code: string) {
    const user = await this.findAppUser(email);
    if (!user) throw this.accountNotFound();

    // Throws INVALID_CODE (with attemptsLeft) / CODE_EXPIRED / CODE_LOCKED when wrong.
    await this.codes.verifyAndRun(user.id, PURPOSE, code, async () => undefined);

    const resetToken = await this.tokens.signResetToken(user.id, this.tokens.passwordFingerprint(user.passwordHash));
    return { resetToken, expiresInSeconds: TokenService.RESET_TTL_SECONDS };
  }

  /**
   * Step 3. Valid token => password changed AND every signed-in device signed out, in one
   * transaction. The token only works once: it carries a fingerprint of the OLD password.
   */
  async reset(resetToken: string, newPassword: string) {
    let claims: { sub: string; pwv: string };
    try {
      claims = await this.tokens.verifyResetToken(resetToken);
    } catch {
      throw this.tokenInvalid();
    }
    const user = await this.prisma.user.findFirst({ where: { id: claims.sub, deletedAt: null, role: { in: ['MEMBER', 'COACH'] } } });
    if (!user || this.tokens.passwordFingerprint(user.passwordHash) !== claims.pwv) throw this.tokenInvalid();

    const passwordHash = await this.passwords.hash(newPassword);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        // They proved they control this inbox, so an unverified email counts as verified now.
        data: { passwordHash, emailVerifiedAt: user.emailVerifiedAt ?? new Date() },
      });
      // Whoever knew the OLD password (or stole a device) must not stay signed in.
      await tx.session.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: 'PASSWORD_CHANGED' },
      });
      await this.audit.record({ actorId: user.id, action: 'password.reset', targetType: 'user', targetId: user.id }, tx);
    });
    return { ok: true };
  }

  private findAppUser(email: string) {
    return this.prisma.user.findFirst({ where: { email, deletedAt: null, role: { in: ['MEMBER', 'COACH'] } } });
  }

  private accountNotFound() {
    return new AppException(404, 'ACCOUNT_NOT_FOUND', 'No account exists with this email. Create an account to get started.');
  }

  private tokenInvalid() {
    return new AppException(400, 'RESET_TOKEN_INVALID', 'This reset session has expired. Please start again.');
  }
}
