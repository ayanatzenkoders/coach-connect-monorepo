import type { Request } from 'express';
import type { Role, SessionAudience } from '../generated/prisma/client.js';

/** What the guard attaches to a request after it has verified token + database state. */
export interface AuthUser {
  id: string;
  role: Role;
  sessionId: string;
  audience: SessionAudience;
}

export type AuthedRequest = Request & { user: AuthUser };
