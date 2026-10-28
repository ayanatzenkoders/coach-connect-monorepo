import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  API_ROUTES,
  ForgotPasswordInputSchema,
  LoginInputSchema,
  RefreshInputSchema,
  RegisterCoachInputSchema,
  RegisterInputSchema,
  ResetPasswordInputSchema,
  VerifyEmailInputSchema,
  VerifyResetCodeInputSchema,
} from '@coach-connect/shared';
import type {
  ForgotPasswordInput,
  LoginInput,
  RefreshInput,
  RegisterCoachInput,
  RegisterInput,
  ResetPasswordInput,
  VerifyEmailInput,
  VerifyResetCodeInput,
} from '@coach-connect/shared';
import type { AuthUser } from '../common/auth-user.js';
import { AllowPendingCoach, Audience, CurrentUser, Public } from '../common/decorators/index.js';
import { AuthService } from './auth.service.js';
import { EmailVerificationService } from './email-verification.service.js';
import { PasswordResetService } from './password-reset.service.js';

// Brute-force protection: 10 attempts per minute per IP on anything that checks a secret.
const AUTH_LIMIT = { default: { limit: 10, ttl: 60_000 } };

@ApiTags('auth')
@Controller()
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly emailVerification: EmailVerificationService,
    private readonly passwordReset: PasswordResetService,
  ) {}

  @Public() @Throttle(AUTH_LIMIT)
  @Post(API_ROUTES.auth.register)
  register(@Body({ schema: RegisterInputSchema }) dto: RegisterInput) {
    return this.auth.register(dto);
  }

  /** A coach applies. The account exists but cannot be used until an admin approves it. */
  @Public() @Throttle(AUTH_LIMIT)
  @Post(API_ROUTES.auth.registerCoach)
  registerCoach(@Body({ schema: RegisterCoachInputSchema }) dto: RegisterCoachInput) {
    return this.auth.registerCoach(dto);
  }

  @Public() @Throttle(AUTH_LIMIT) @HttpCode(200)
  @Post(API_ROUTES.auth.login)
  login(@Body({ schema: LoginInputSchema }) dto: LoginInput) {
    return this.auth.login(dto, 'MOBILE');
  }

  /** Works for both mobile and admin sessions: the session row knows which it is. */
  @Public() @Throttle(AUTH_LIMIT) @HttpCode(200)
  @Post(API_ROUTES.auth.refresh)
  refresh(@Body({ schema: RefreshInputSchema }) dto: RefreshInput) {
    return this.auth.refresh(dto.refreshToken);
  }

  @AllowPendingCoach() @Audience('any') @HttpCode(204)
  @Post(API_ROUTES.auth.logout)
  async logout(@CurrentUser() user: AuthUser) {
    await this.auth.logout(user.sessionId);
  }

  @AllowPendingCoach() @Audience('any')
  @Get(API_ROUTES.auth.me)
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }

  /** Email me a (new) 6-digit code. Needs login; at most one per minute. */
  @AllowPendingCoach() @Throttle(AUTH_LIMIT) @HttpCode(200)
  @Post(API_ROUTES.auth.emailSendCode)
  sendEmailCode(@CurrentUser() user: AuthUser) {
    return this.emailVerification.sendCode(user.id);
  }

  @AllowPendingCoach() @Throttle(AUTH_LIMIT) @HttpCode(200)
  @Post(API_ROUTES.auth.emailVerify)
  verifyEmail(@CurrentUser() user: AuthUser, @Body({ schema: VerifyEmailInputSchema }) dto: VerifyEmailInput) {
    return this.emailVerification.verify(user.id, dto.code);
  }

  /** "Forgot password", step 1: email me a code. 404 ACCOUNT_NOT_FOUND if there is no such account. */
  @Public() @Throttle(AUTH_LIMIT) @HttpCode(200)
  @Post(API_ROUTES.auth.passwordForgot)
  forgotPassword(@Body({ schema: ForgotPasswordInputSchema }) dto: ForgotPasswordInput) {
    return this.passwordReset.requestCode(dto.email);
  }

  /** Step 2: check the emailed code. Returns a short-lived `resetToken` for step 3. */
  @Public() @Throttle(AUTH_LIMIT) @HttpCode(200)
  @Post(API_ROUTES.auth.passwordVerifyCode)
  verifyResetCode(@Body({ schema: VerifyResetCodeInputSchema }) dto: VerifyResetCodeInput) {
    return this.passwordReset.verifyCode(dto.email, dto.code);
  }

  /** Step 3: reset token + new password. Signs out every device on success. */
  @Public() @Throttle(AUTH_LIMIT) @HttpCode(200)
  @Post(API_ROUTES.auth.passwordReset)
  resetPassword(@Body({ schema: ResetPasswordInputSchema }) dto: ResetPasswordInput) {
    return this.passwordReset.reset(dto.resetToken, dto.newPassword);
  }
}
