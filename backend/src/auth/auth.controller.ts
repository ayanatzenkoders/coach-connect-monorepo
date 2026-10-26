import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../common/auth-user.js';
import { Audience, CurrentUser, Public } from '../common/decorators/index.js';
import { AuthService } from './auth.service.js';
import { LoginDto, RefreshDto, RegisterDto, VerifyEmailDto } from './dto/auth.dto.js';
import { EmailVerificationService } from './email-verification.service.js';

// Brute-force protection: 10 attempts per minute per IP on anything that checks a secret.
const AUTH_LIMIT = { default: { limit: 10, ttl: 60_000 } };

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly emailVerification: EmailVerificationService,
  ) {}

  @Public() @Throttle(AUTH_LIMIT)
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Public() @Throttle(AUTH_LIMIT) @HttpCode(200)
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto, 'MOBILE');
  }

  /** Works for both mobile and admin sessions: the session row knows which it is. */
  @Public() @Throttle(AUTH_LIMIT) @HttpCode(200)
  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Audience('any') @HttpCode(204)
  @Post('logout')
  async logout(@CurrentUser() user: AuthUser) {
    await this.auth.logout(user.sessionId);
  }

  @Audience('any')
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }

  /** Email me a (new) 6-digit code. Needs login; at most one per minute. */
  @Throttle(AUTH_LIMIT) @HttpCode(200)
  @Post('email/send-code')
  sendEmailCode(@CurrentUser() user: AuthUser) {
    return this.emailVerification.sendCode(user.id);
  }

  @Throttle(AUTH_LIMIT) @HttpCode(200)
  @Post('email/verify')
  verifyEmail(@CurrentUser() user: AuthUser, @Body() dto: VerifyEmailDto) {
    return this.emailVerification.verify(user.id, dto.code);
  }
}
