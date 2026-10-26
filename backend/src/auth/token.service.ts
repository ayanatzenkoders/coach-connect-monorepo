import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Role, SessionAudience } from '../generated/prisma/client.js';

export const JWT_ISSUER = 'coach-connect';

export interface AccessPayload {
  sub: string; // user id
  sid: string; // session id (lets the server cut a token off instantly)
  role: Role; // convenience for the client only. The server re-reads the role from the database.
  aud: 'mobile' | 'admin';
}

@Injectable()
export class TokenService {
  readonly accessTtlSeconds: number;

  constructor(
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    this.accessTtlSeconds = config.getOrThrow<number>('ACCESS_TOKEN_TTL_SECONDS');
  }

  // ───── Access token: a signed JWT, short-lived, checked on every request ─────

  signAccess(args: { userId: string; sessionId: string; role: Role; audience: SessionAudience }) {
    const payload = { sid: args.sessionId, role: args.role };
    return this.jwt.signAsync(payload, {
      subject: args.userId,
      issuer: JWT_ISSUER,
      audience: args.audience === 'ADMIN' ? 'admin' : 'mobile',
      expiresIn: this.accessTtlSeconds,
    });
  }

  /** Throws if the signature is wrong, the token is expired, or the issuer differs. */
  verifyAccess(token: string): Promise<AccessPayload> {
    return this.jwt.verifyAsync<AccessPayload>(token, { issuer: JWT_ISSUER });
  }

  // ───── Refresh token: random secret, only its hash is stored ─────

  /** Format "<sessionId>.<secret>": the id finds the session row, the secret proves possession. */
  newRefreshSecret(): string {
    return randomBytes(32).toString('base64url');
  }

  formatRefresh(sessionId: string, secret: string): string {
    return `${sessionId}.${secret}`;
  }

  parseRefresh(token: string): { sessionId: string; secret: string } | null {
    const dot = token.indexOf('.');
    if (dot <= 0 || dot === token.length - 1) return null;
    return { sessionId: token.slice(0, dot), secret: token.slice(dot + 1) };
  }

  /**
   * SHA-256 is enough here (unlike passwords): the secret is 256 random bits, so it cannot be
   * guessed or brute-forced. A fast hash keeps refresh cheap. Only the hash is stored, so a
   * database leak does not leak usable tokens.
   */
  hashSecret(secret: string): string {
    return createHash('sha256').update(secret).digest('hex');
  }

  /** Constant-time compare so response time cannot leak how many characters matched. */
  safeEqual(a: string, b: string): boolean {
    const ab = Buffer.from(a);
    const bb = Buffer.from(b);
    return ab.length === bb.length && timingSafeEqual(ab, bb);
  }
}
