import { z } from 'zod';

/** "true" / "false" typed in a .env file. (z.coerce.boolean() would turn the text "false" into true.) */
const envBoolean = z.enum(['true', 'false']).transform((value) => value === 'true');

/**
 * Every environment variable the API reads is declared here. ConfigModule runs `validateEnv` at boot,
 * so a missing or weak value stops the app at start-up instead of failing later at request time.
 */
export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().min(10),

  /** Signs access tokens (JWTs). 32+ chars: `openssl rand -base64 48`. */
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  /** How long an access token is valid. Short on purpose (see knowledge.md). */
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
  /** A session dies after this many days WITHOUT a refresh (sliding window). */
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),

  // ───── Email ─────
  /** console = print emails in this terminal (default); smtp = a real mail server; resend = the Resend web service. */
  MAIL_DRIVER: z.enum(['console', 'smtp', 'resend']).default('console'),
  /** The "From" line, e.g.  Coach Connect <you@gmail.com> . Gmail only lets you send as your own address. */
  MAIL_FROM: z.string().min(3).default('Coach Connect <no-reply@coachconnect.dev>'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).optional(),
  /** true for port 465 (TLS from the start); false for 587 (STARTTLS). */
  SMTP_SECURE: envBoolean.optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

/** Settings each mail driver cannot work without. */
const REQUIRED_FOR_DRIVER: Record<string, (keyof Env)[]> = {
  smtp: ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'],
  resend: ['RESEND_API_KEY'],
};

export function validateEnv(raw: Record<string, unknown>): Env {
  // A blank line like `SMTP_PORT=` in .env means "not set", not "an empty value".
  const present = Object.fromEntries(Object.entries(raw).filter(([, value]) => value !== ''));
  const parsed = EnvSchema.safeParse(present);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`);
    throw new Error(`Invalid environment configuration:\n${lines.join('\n')}`);
  }
  const env = parsed.data;
  // Fail at start-up (not at the first password reset) if the chosen mail driver is half set up.
  const missing = (REQUIRED_FOR_DRIVER[env.MAIL_DRIVER] ?? []).filter((key) => env[key] === undefined);
  if (missing.length > 0) {
    throw new Error(`Invalid environment configuration:\n  - MAIL_DRIVER=${env.MAIL_DRIVER} also needs: ${missing.join(', ')}`);
  }
  return env;
}
