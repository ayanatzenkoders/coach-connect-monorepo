import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../common/auth-user.js';
import { Audience, CurrentUser, Public } from '../common/decorators/index.js';
import { AuthService } from './auth.service.js';
import { ForgotPasswordDto, LoginDto, RefreshDto, RegisterDto, ResetPasswordDto, VerifyEmailDto, VerifyResetCodeDto } from './dto/auth.dto.js';
import { EmailVerificationService } from './email-verification.service.js';
import { PasswordResetService } from './password-reset.service.js';

// Brute-force protection: 10 attempts per minute per IP on anything that checks a secret.
const AUTH_LIMIT = { default: { limit: 10, ttl: 60_000 } };

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly emailVerification: EmailVerificationService,
    private readonly passwordReset: PasswordResetService,
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

  /** "Forgot password", step 1: email me a code. 404 ACCOUNT_NOT_FOUND if there is no such account. */
  @Public() @Throttle(AUTH_LIMIT) @HttpCode(200)
  @Post('password/forgot')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.passwordReset.requestCode(dto.email);
  }

  /** Step 2: check the emailed code. Returns a short-lived `resetToken` for step 3. */
  @Public() @Throttle(AUTH_LIMIT) @HttpCode(200)
  @Post('password/verify-code')
  verifyResetCode(@Body() dto: VerifyResetCodeDto) {
    return this.passwordReset.verifyCode(dto.email, dto.code);
  }

  /** Step 3: reset token + new password. Signs out every device on success. */
  @Public() @Throttle(AUTH_LIMIT) @HttpCode(200)
  @Post('password/reset')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.passwordReset.reset(dto.resetToken, dto.newPassword);
  }
}
