import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { LoginDto } from '../auth/dto/auth.dto.js';
import { AuthService } from '../auth/auth.service.js';
import type { AuthUser } from '../common/auth-user.js';
import { Audience, CurrentUser, Public, Roles } from '../common/decorators/index.js';
import { AppException } from '../common/errors/app.exception.js';
import { BanService } from '../moderation/ban.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { BanDto } from './admin.dto.js';

/**
 * Admin web panel API. Every route here needs an ADMIN-audience token (issued only to
 * SUPPORT/ADMIN accounts). Cookie transport + 2FA arrive with the admin panel (Phase 9).
 */
@Controller('admin')
@Audience('admin')
export class AdminController {
  constructor(
    private readonly auth: AuthService,
    private readonly bans: BanService,
    private readonly prisma: PrismaService,
  ) {}

  @Public() @Throttle({ default: { limit: 10, ttl: 60_000 } }) @HttpCode(200)
  @Post('auth/login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto, 'ADMIN');
  }

  /** READ-ONLY: Support and Admin both allowed. */
  @Roles('SUPPORT', 'ADMIN')
  @Get('users/:id')
  async getUser(@Param('id', new ParseUUIDPipe()) id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true, email: true, name: true, role: true, isBanned: true, bannedAt: true, banReason: true,
        createdAt: true,
        subscription: { select: { status: true, expiresAt: true } },
        _count: { select: { sessions: { where: { revokedAt: null } } } },
      },
    });
    if (!user) throw new AppException(404, 'USER_NOT_FOUND', 'User not found.');
    return user;
  }

  /** WRITE: Admin only. Support gets 403 from RolesGuard even with a valid token. */
  @Roles('ADMIN') @HttpCode(200)
  @Post('users/:id/ban')
  ban(@CurrentUser() actor: AuthUser, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: BanDto) {
    return this.bans.ban(actor.id, id, dto.reason, dto.note);
  }

  @Roles('ADMIN') @HttpCode(200)
  @Post('users/:id/unban')
  unban(@CurrentUser() actor: AuthUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.bans.unban(actor.id, id);
  }
}
