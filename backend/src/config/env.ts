import { plainToInstance, Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min, MinLength, validateSync } from 'class-validator';

/**
 * Every environment variable the API needs. The app refuses to start if one is missing or
 * weak, so a bad deploy fails loudly at boot instead of misbehaving later.
 */
class EnvironmentVariables {
  @IsIn(['development', 'test', 'production'])
  NODE_ENV: string = 'development';

  @Type(() => Number) @IsInt() @Min(1) @Max(65535)
  PORT: number = 3000;

  @IsString() @MinLength(10)
  DATABASE_URL!: string;

  /** Signs access tokens (JWTs). 32+ chars: `openssl rand -base64 48`. */
  @IsString() @MinLength(32, { message: 'JWT_ACCESS_SECRET must be at least 32 characters' })
  JWT_ACCESS_SECRET!: string;

  /** How long an access token is valid. Short on purpose (see knowledge.md). */
  @Type(() => Number) @IsInt() @Min(60) @Max(3600)
  ACCESS_TOKEN_TTL_SECONDS: number = 900;

  /** A session dies after this many days WITHOUT a refresh (sliding window). */
  @Type(() => Number) @IsInt() @Min(1) @Max(365)
  SESSION_TTL_DAYS: number = 30;

  // ───── Email ─────
  /** console = print emails in this terminal (default); smtp = a real mail server; resend = the Resend web service. */
  @IsIn(['console', 'smtp', 'resend'])
  MAIL_DRIVER: string = 'console';

  /** The "From" line, e.g.  Coach Connect <you@gmail.com> . Gmail only lets you send as your own address. */
  @IsString() @MinLength(3)
  MAIL_FROM: string = 'Coach Connect <no-reply@coachconnect.dev>';

  @IsOptional() @IsString() SMTP_HOST?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(65535) SMTP_PORT?: number;
  /** true for port 465 (TLS from the start); false for 587 (STARTTLS). Note: the text "false" must mean false. */
  @IsOptional() // Read the ORIGINAL text: the automatic converter would turn the text "false" into true.
  @Transform(({ obj, key }) => obj[key] === true || obj[key] === 'true') @IsBoolean() SMTP_SECURE?: boolean;
  @IsOptional() @IsString() SMTP_USER?: string;
  @IsOptional() @IsString() SMTP_PASS?: string;
  @IsOptional() @IsString() RESEND_API_KEY?: string;
}

/** Settings each mail driver cannot work without. */
const REQUIRED_FOR_DRIVER: Record<string, (keyof EnvironmentVariables)[]> = {
  smtp: ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'],
  resend: ['RESEND_API_KEY'],
};

export function validateEnv(raw: Record<string, unknown>) {
  // A blank line like `SMTP_PORT=` in .env means "not set", not "an empty value".
  const present = Object.fromEntries(Object.entries(raw).filter(([, value]) => value !== ''));
  const env = plainToInstance(EnvironmentVariables, present, { enableImplicitConversion: true });
  const errors = validateSync(env, { skipMissingProperties: false });
  if (errors.length > 0) {
    const lines = errors.map((e) => `  - ${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`);
    throw new Error(`Invalid environment configuration:\n${lines.join('\n')}`);
  }
  // Fail at start-up (not at the first password reset) if the chosen mail driver is half set up.
  const missing = (REQUIRED_FOR_DRIVER[env.MAIL_DRIVER] ?? []).filter((key) => env[key] === undefined || env[key] === '');
  if (missing.length > 0) {
    throw new Error(`Invalid environment configuration:\n  - MAIL_DRIVER=${env.MAIL_DRIVER} also needs: ${missing.join(', ')}`);
  }
  return env;
}
