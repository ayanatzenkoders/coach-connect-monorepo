import { BadRequestException, Injectable, StandardSchemaValidationPipe, type StandardSchemaValidationPipeOptions } from '@nestjs/common';
import type { ApiError } from '@coach-connect/shared';

type Issues = Parameters<NonNullable<StandardSchemaValidationPipeOptions['exceptionFactory']>>[0];

/**
 * Global validation pipe (registered as APP_PIPE in AppModule).
 *
 * Nest 12 accepts any Standard Schema (zod 4 included) on parameter decorators:
 *   `@Body({ schema: LoginInputSchema }) body: LoginInput`
 * This pipe checks the request against that schema, hands the controller the PARSED value (defaults,
 * trimming and number/boolean conversion already applied) and turns failures into the shared `ApiError`
 * shape, so the apps can show each message next to the right field:
 *   { statusCode: 400, message: "Validation failed", errors: { email: ["Invalid email address"] } }
 */
@Injectable()
export class ZodValidationPipe extends StandardSchemaValidationPipe {
  constructor() {
    super({ exceptionFactory: (issues) => ZodValidationPipe.toException(issues) });
  }

  static toException(issues: Issues): BadRequestException {
    const errors: Record<string, string[]> = {};
    for (const issue of issues) {
      const key = issue.path?.map((segment) => String(typeof segment === 'object' ? segment.key : segment)).join('.') || '_root';
      (errors[key] ??= []).push(issue.message);
    }
    const body: ApiError = { statusCode: 400, message: 'Validation failed', errors };
    return new BadRequestException(body);
  }
}
