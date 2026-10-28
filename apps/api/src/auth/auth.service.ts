import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, type Role, type SessionAudience, type User } from '../generated/prisma/client.js';
import { AuditService } from '../audit/audit.service.js';
import { AppException } from '../common/errors/app.exception.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { hasActiveAccess } from '../subscriptions/subscription-access.js';
import type { LoginInput, RegisterInput } from '@coach-connect/shared';
import { EmailVerificationService } from './email-verification.service.js';
import { PasswordService } from './password.service.js';
import { TokenService } from './token.service.js';

/**
 * If a rotated-away refresh token is shown again within this window we assume a lost
 * response / double request (not theft) and simply rotate again. After it, reuse = theft.
 */
export const REFRESH_GRACE_MS = 30_000;

/** Which roles may sign in to which client. A Member can never get an admin session. */
const ROLES_FOR: Record<SessionAudience, Role[]> = {
  MOBILE: ['MEMBER', 'COACH'],
  ADMIN: ['SUPPORT', 'ADMIN'],
};

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  /** Seconds until the access token expires. */
  expiresIn: number;
  user: PublicUser;
}

interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  emailVerified: boolean;
}

const toPublic = (u: User): PublicUser => ({
  id: u.id,
  email: u.email,
  name: u.name,
  role: u.role,
  emailVerified: u.emailVerifiedAt !== null,
});

@Injectable()
export class AuthService {
  private readonly sessionTtlMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
    private readonly emailVerification: EmailVerificationService,
    private readonly realtime: RealtimeService,
    config: ConfigService,
  ) {
    this.sessionTtlMs = config.getOrThrow<number>('SESSION_TTL_DAYS') * 86_400_000;
  }

  // ─────────────────────────── register ───────────────────────────

  /** Public sign-up always creates a MEMBER. Coaches/admins are created by an Admin. */
  async register(dto: RegisterInput): Promise<AuthResult> {
    const taken = await this.prisma.user.findFirst({
      where: { email: dto.email, deletedAt: null },
      select: { id: true },
    });
    if (taken) throw this.emailTaken();

    const passwordHash = await this.passwords.hash(dto.password);
    let user: User;
    try {
      user = await this.prisma.user.create({
        data: { email: dto.email, passwordHash, name: dto.name.trim(), role: 'MEMBER' },
      });
    } catch (e) {
      // Two sign-ups racing past the check above: the partial unique index catches the loser.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw this.emailTaken();
      throw e;
    }
    // Email the verification code. If the email fails, sign-up still works: the app can ask again.
    await this.emailVerification.sendCode(user.id).catch(() => undefined);
    return this.startSession(user, 'MOBILE', dto.deviceId, dto.deviceName);
  }

  // ─────────────────────────── login ───────────────────────────

  async login(dto: LoginInput, audience: SessionAudience): Promise<AuthResult> {
    const user = await this.prisma.user.findFirst({ where: { email: dto.email, deletedAt: null } });

    // Same error for "no such email", "wrong password", "social-only account" and
    // "wrong app for this role": the caller learns nothing about which one it was.
    if (!user || !user.passwordHash) {
      await this.passwords.burnTime(dto.password);
      throw this.invalidCredentials();
    }
    const ok = await this.passwords.verify(user.passwordHash, dto.password);
    if (!ok || !ROLES_FOR[audience].includes(user.role)) throw this.invalidCredentials();

    // Only someone who proved the password gets told the account is banned.
    if (user.bannedAt) throw this.banned();

    if (this.passwords.needsRehash(user.passwordHash)) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: await this.passwords.hash(dto.password) },
      });
    }
    return this.startSession(user, audience, dto.deviceId, dto.deviceName);
  }

  // ─────────────────────────── refresh (rotation) ───────────────────────────

  async refresh(refreshToken: string): Promise<AuthResult> {
    const parsed = this.tokens.parseRefresh(refreshToken);
    if (!parsed) throw this.invalidRefresh();
    const presentedHash = this.tokens.hashSecret(parsed.secret);

    // Two tries: if a parallel request rotated the token between our read and our write,
    // the second try sees it as "previous token, inside the grace window" and succeeds.
    for (let attempt = 0; attempt < 2; attempt++) {
      const session = await this.prisma.session.findUnique({
        where: { id: parsed.sessionId },
        include: { user: true },
      });
      if (!session) throw this.invalidRefresh();
      if (session.revokedAt) throw new AppException(401, 'SESSION_REVOKED', 'Session ended. Please sign in again.');
      if (session.expiresAt.getTime() <= Date.now()) {
        throw new AppException(401, 'SESSION_EXPIRED', 'Session expired. Please sign in again.');
      }

      const isCurrent = this.tokens.safeEqual(presentedHash, session.refreshTokenHash);
      const isPrevious =
        session.previousRefreshTokenHash !== null && this.tokens.safeEqual(presentedHash, session.previousRefreshTokenHash);
      if (!isCurrent && !isPrevious) throw this.invalidRefresh();

      if (isPrevious && Date.now() - session.rotatedAt.getTime() > REFRESH_GRACE_MS) {
        // An old token came back after the grace window: someone is replaying a stolen token.
        // Kill the whole session so neither the thief nor the owner can continue.
        await this.prisma.$transaction(async (tx) => {
          await tx.session.update({
            where: { id: session.id },
            data: { revokedAt: new Date(), revokedReason: 'REUSE_DETECTED' },
          });
          await this.audit.record(
            { actorId: session.userId, action: 'session.reuse_detected', targetType: 'session', targetId: session.id },
            tx,
          );
        });
        // REAL-TIME: the session is dead, so its live socket (the thief's or the owner's) must not keep receiving messages.
        this.realtime.disconnectSession(session.id);
        throw new AppException(401, 'REFRESH_REUSED', 'Security check failed. Please sign in again.');
      }

      const user = session.user;
      if (user.deletedAt) throw new AppException(401, 'SESSION_REVOKED', 'Session ended. Please sign in again.');
      if (user.bannedAt) throw this.banned();

      const newSecret = this.tokens.newRefreshSecret();
      const now = new Date();
      // Optimistic lock: only succeeds if nobody rotated since we read the row.
      const updated = await this.prisma.session.updateMany({
        where: { id: session.id, refreshTokenHash: session.refreshTokenHash, revokedAt: null },
        data: {
          previousRefreshTokenHash: session.refreshTokenHash,
          refreshTokenHash: this.tokens.hashSecret(newSecret),
          rotatedAt: now,
          lastSeenAt: now,
          expiresAt: new Date(now.getTime() + this.sessionTtlMs),
        },
      });
      if (updated.count === 0) continue; // lost a race: re-read and retry

      return {
        accessToken: await this.tokens.signAccess({
          userId: user.id,
          sessionId: session.id,
          role: user.role,
          audience: session.audience,
        }),
        refreshToken: this.tokens.formatRefresh(session.id, newSecret),
        expiresIn: this.tokens.accessTtlSeconds,
        user: toPublic(user),
      };
    }
    throw new AppException(409, 'REFRESH_CONFLICT', 'Please try again.');
  }

  // ─────────────────────────── logout / me ───────────────────────────

  async logout(sessionId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: 'LOGOUT' },
    });
    // REAL-TIME: this device signed out, so close its socket (the user's other devices stay connected).
    this.realtime.disconnectSession(sessionId);
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { subscription: true },
    });
    return {
      ...toPublic(user),
      subscription: user.subscription
        ? { status: user.subscription.status, expiresAt: user.subscription.expiresAt }
        : null,
      // Coaches never need a subscription; members do.
      canCall: user.role === 'COACH' || hasActiveAccess(user.subscription),
    };
  }

  // ─────────────────────────── internals ───────────────────────────

  /** Creates the session row and the first pair of tokens. */
  private async startSession(
    user: User,
    audience: SessionAudience,
    deviceId: string,
    deviceName?: string,
  ): Promise<AuthResult> {
    const secret = this.tokens.newRefreshSecret();
    let replaced: { id: string }[] = [];
    const session = await this.prisma.$transaction(async (tx) => {
      // One live session per device: signing in again replaces the old one.
      replaced = await tx.session.findMany({ where: { userId: user.id, deviceId, revokedAt: null }, select: { id: true } });
      await tx.session.updateMany({
        where: { userId: user.id, deviceId, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: 'REPLACED' },
      });
      return tx.session.create({
        data: {
          userId: user.id,
          audience,
          deviceId,
          deviceName,
          refreshTokenHash: this.tokens.hashSecret(secret),
          expiresAt: new Date(Date.now() + this.sessionTtlMs),
        },
      });
    });
    // REAL-TIME: the replaced login is over, so close its socket (after the commit, like every push).
    replaced.forEach((old) => this.realtime.disconnectSession(old.id));
    return {
      accessToken: await this.tokens.signAccess({
        userId: user.id,
        sessionId: session.id,
        role: user.role,
        audience,
      }),
      refreshToken: this.tokens.formatRefresh(session.id, secret),
      expiresIn: this.tokens.accessTtlSeconds,
      user: toPublic(user),
    };
  }

  private invalidCredentials() {
    return new AppException(HttpStatus.UNAUTHORIZED, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
  }
  private invalidRefresh() {
    return new AppException(HttpStatus.UNAUTHORIZED, 'INVALID_REFRESH_TOKEN', 'Please sign in again.');
  }
  private emailTaken() {
    return new AppException(HttpStatus.CONFLICT, 'EMAIL_TAKEN', 'An account with this email already exists.');
  }
  private banned() {
    return new AppException(HttpStatus.FORBIDDEN, 'ACCOUNT_BANNED', 'This account has been suspended.');
  }
}
