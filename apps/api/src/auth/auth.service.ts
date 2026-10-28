import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, type Role, type SessionAudience, type User } from '../generated/prisma/client.js';
import { AuditService } from '../audit/audit.service.js';
import { AppException } from '../common/errors/app.exception.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { hasActiveAccess } from '../subscriptions/subscription-access.js';
import type { LoginInput, RegisterCoachInput, RegisterInput } from '@coach-connect/shared';
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
  /** A coach an admin has not approved yet (the app shows "waiting for approval" instead of the home screen). */
  pendingApproval: boolean;
}

/** A user row together with the coach approval (the profile row may not exist for a brand new coach). */
type UserWithProfile = User & { coachProfile?: { approved: boolean } | null };

const toPublic = (u: UserWithProfile): PublicUser => ({
  id: u.id,
  email: u.email,
  name: u.name,
  role: u.role,
  emailVerified: u.emailVerifiedAt !== null,
  pendingApproval: u.role === 'COACH' && !u.coachProfile?.approved,
});

/** "2000-01-31" -> a Date at midnight UTC, which the database stores as that calendar day (column type DATE). */
const dayOf = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

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
        data: { email: dto.email, passwordHash, name: dto.name.trim(), dateOfBirth: dayOf(dto.dateOfBirth), role: 'MEMBER' },
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

  /**
   * A coach applies. Same steps as a member (account, verification email, a session so they can type the code), but the
   * account starts UNAPPROVED: the profile row is created with `approved = false`, so they are invisible in People and
   * every route except verify-email / me / logout answers 403 until an admin approves. User and profile are saved together.
   */
  async registerCoach(dto: RegisterCoachInput): Promise<AuthResult> {
    const taken = await this.prisma.user.findFirst({ where: { email: dto.email, deletedAt: null }, select: { id: true } });
    if (taken) throw this.emailTaken();

    const passwordHash = await this.passwords.hash(dto.password);
    let user: UserWithProfile;
    try {
      user = await this.prisma.user.create({
        data: {
          email: dto.email,
          passwordHash,
          name: dto.name.trim(),
          phone: dto.phone,
          dateOfBirth: dayOf(dto.dateOfBirth),
          role: 'COACH',
          coachProfile: { create: { bio: dto.bio, specialties: dto.specialties, approved: false, available: false } },
        },
        include: { coachProfile: { select: { approved: true } } },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw this.emailTaken();
      throw e;
    }
    await this.emailVerification.sendCode(user.id).catch(() => undefined);
    return this.startSession(user, 'MOBILE', dto.deviceId, dto.deviceName);
  }

  // ─────────────────────────── login ───────────────────────────

  async login(dto: LoginInput, audience: SessionAudience): Promise<AuthResult> {
    const user = await this.prisma.user.findFirst({ where: { email: dto.email, deletedAt: null }, include: { coachProfile: { select: { approved: true } } } });

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

    // A coach who verified their email and now waits for an admin cannot sign in yet. One who has NOT verified yet may
    // (it is the only way to get the code screen back after closing the app); the API still limits them to verifying.
    if (toPublic(user).pendingApproval && user.emailVerifiedAt) {
      throw new AppException(403, 'COACH_PENDING_APPROVAL', 'Your application is waiting for approval. We will email you as soon as it is approved.');
    }

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
        include: { user: { include: { coachProfile: { select: { approved: true } } } } },
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
      include: { subscription: true, coachProfile: { select: { approved: true } } },
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
    user: UserWithProfile,
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
