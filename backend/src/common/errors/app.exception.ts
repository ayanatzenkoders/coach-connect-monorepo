import { HttpException } from '@nestjs/common';

/**
 * Error with a stable machine-readable `code` the mobile app can switch on
 * (e.g. ACCOUNT_BANNED -> log out and show a message), plus a human message.
 */
export class AppException extends HttpException {
  constructor(
    status: number,
    public readonly code: string,
    message: string,
  ) {
    super({ statusCode: status, code, message }, status);
  }
}
