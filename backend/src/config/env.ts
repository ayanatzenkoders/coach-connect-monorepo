import { plainToInstance } from 'class-transformer';
import { IsIn, IsInt, IsString, Max, Min, MinLength, validateSync } from 'class-validator';

/**
 * Every environment variable the API needs. The app refuses to start if one is missing or
 * weak, so a bad deploy fails loudly at boot instead of misbehaving later.
 */
class EnvironmentVariables {
  @IsIn(['development', 'test', 'production'])
  NODE_ENV: string = 'development';

  @IsInt() @Min(1) @Max(65535)
  PORT: number = 3000;

  @IsString() @MinLength(10)
  DATABASE_URL!: string;

  /** Signs access tokens (JWTs). 32+ chars: `openssl rand -base64 48`. */
  @IsString() @MinLength(32, { message: 'JWT_ACCESS_SECRET must be at least 32 characters' })
  JWT_ACCESS_SECRET!: string;

  /** How long an access token is valid. Short on purpose (see knowledge.md). */
  @IsInt() @Min(60) @Max(3600)
  ACCESS_TOKEN_TTL_SECONDS: number = 900;

  /** A session dies after this many days WITHOUT a refresh (sliding window). */
  @IsInt() @Min(1) @Max(365)
  SESSION_TTL_DAYS: number = 30;
}

export function validateEnv(raw: Record<string, unknown>) {
  const env = plainToInstance(EnvironmentVariables, raw, { enableImplicitConversion: true });
  const errors = validateSync(env, { skipMissingProperties: false });
  if (errors.length > 0) {
    const lines = errors.map((e) => `  - ${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`);
    throw new Error(`Invalid environment configuration:\n${lines.join('\n')}`);
  }
  return env;
}
