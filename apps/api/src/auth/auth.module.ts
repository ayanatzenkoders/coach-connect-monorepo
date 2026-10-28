import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { EmailVerificationService } from './email-verification.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { VerificationCodeService } from './verification-code.service.js';
import { PasswordResetService } from './password-reset.service.js';
import { PasswordService } from './password.service.js';
import { RolesGuard } from './roles.guard.js';
import { SessionAuthService } from './session-auth.service.js';
import { TokenService } from './token.service.js';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        signOptions: { algorithm: 'HS256' },
        verifyOptions: { algorithms: ['HS256'] }, // never accept "alg: none" or other algorithms
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, EmailVerificationService, VerificationCodeService, PasswordResetService, PasswordService, SessionAuthService, TokenService, JwtAuthGuard, RolesGuard],
  exports: [AuthService, EmailVerificationService, VerificationCodeService, PasswordService, SessionAuthService, TokenService, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
