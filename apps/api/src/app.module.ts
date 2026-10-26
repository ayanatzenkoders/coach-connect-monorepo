import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_PIPE } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AdminModule } from './admin/admin.module.js';
import { AuditModule } from './audit/audit.module.js';
import { AuthModule } from './auth/auth.module.js';
import { JwtAuthGuard } from './auth/jwt-auth.guard.js';
import { RolesGuard } from './auth/roles.guard.js';
import { ZodValidationPipe } from './common/pipes/zod-validation.pipe.js';
import { validateEnv } from './config/env.js';
import { ChatModule } from './chat/chat.module.js';
import { HealthModule } from './health/health.module.js';
import { MailModule } from './mail/mail.module.js';
import { PeopleModule } from './people/people.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [
    // Reads backend/.env into process.env and validates it at boot.
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validateEnv }),
    // Default limit for every route; auth routes tighten it with @Throttle.
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60_000, limit: 120 }],
      skipIf: () => process.env.NODE_ENV === 'test',
    }),
    EventEmitterModule.forRoot(),
    PrismaModule,
    AuditModule,
    MailModule,
    AuthModule,
    AdminModule,
    PeopleModule,
    ChatModule,
    HealthModule,
  ],
  providers: [
    // Checks every request against the zod schema named on the param decorator.
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    // Order matters: 1) rate limit, 2) must be logged in, 3) must have the right role.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
