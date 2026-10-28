import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AdminUsersQuerySchema, API_ROUTES, BanInputSchema, IdSchema, LoginInputSchema } from '@coach-connect/shared';
import type { AdminUsersQueryParsed, BanInput, LoginInput } from '@coach-connect/shared';
import { AuthService } from '../auth/auth.service.js';
import type { AuthUser } from '../common/auth-user.js';
import { Audience, CurrentUser, Public, Roles } from '../common/decorators/index.js';
import { AppException } from '../common/errors/app.exception.js';
import { BanService } from '../moderation/ban.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AdminUsersService } from './admin-users.service.js';
import { CoachApprovalService } from './coach-approval.service.js';

/**
 * Admin web panel API. Every route here needs an ADMIN-audience token (issued only to
 * SUPPORT/ADMIN accounts). Cookie transport + 2FA arrive with the admin panel (Phase 9).
 */
@ApiTags('admin')
@Controller()
@Audience('admin')
export class AdminController {
  constructor(
    private readonly auth: AuthService,
    private readonly bans: BanService,
    private readonly prisma: PrismaService,
    private readonly users: AdminUsersService,
    private readonly approvals: CoachApprovalService,
  ) {}

  @Public() @Throttle({ default: { limit: 10, ttl: 60_000 } }) @HttpCode(200)
  @Post(API_ROUTES.admin.login)
  login(@Body({ schema: LoginInputSchema }) dto: LoginInput) {
    return this.auth.login(dto, 'ADMIN');
  }

  /** READ-ONLY: the user list (search, role and status filters, paging). Support and Admin both allowed. */
  @Roles('SUPPORT', 'ADMIN')
  @Get(API_ROUTES.admin.users)
  listUsers(@CurrentUser() actor: AuthUser, @Query({ schema: AdminUsersQuerySchema }) query: AdminUsersQueryParsed) {
    return this.users.list(query, actor.role);
  }

  /** READ-ONLY: Support and Admin both allowed. */
  @Roles('SUPPORT', 'ADMIN')
  @Get(API_ROUTES.admin.user)
  async getUser(@Param('id', { schema: IdSchema }) id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true, email: true, name: true, role: true, bannedAt: true,
        createdAt: true,
        subscription: { select: { status: true, expiresAt: true } },
        _count: { select: { sessions: { where: { revokedAt: null } } } },
      },
    });
    if (!user) throw new AppException(404, 'USER_NOT_FOUND', 'User not found.');
    // The ban reason is not stored on the user: it lives in the audit entry written by the ban.
    const banEntry = user.bannedAt
      ? await this.prisma.auditLog.findFirst({
          where: { action: 'user.ban', targetType: 'user', targetId: id },
          orderBy: { createdAt: 'desc' },
          select: { actorId: true, metadata: true },
        })
      : null;
    const reason = (banEntry?.metadata as { reason?: string } | null)?.reason ?? null;
    return { ...user, isBanned: user.bannedAt !== null, banReason: reason, bannedById: banEntry?.actorId ?? null };
  }

  /** WRITE: Admin only. Support gets 403 from RolesGuard even with a valid token. */
  @Roles('ADMIN') @HttpCode(200)
  @Post(API_ROUTES.admin.ban)
  ban(@CurrentUser() actor: AuthUser, @Param('id', { schema: IdSchema }) id: string, @Body({ schema: BanInputSchema }) dto: BanInput) {
    return this.bans.ban(actor.id, id, dto.reason, dto.note);
  }

  @Roles('ADMIN') @HttpCode(200)
  @Post(API_ROUTES.admin.unban)
  unban(@CurrentUser() actor: AuthUser, @Param('id', { schema: IdSchema }) id: string) {
    return this.bans.unban(actor.id, id);
  }

  /** Make a coach visible to members (People list and new chats). Admin only. To remove a coach, ban them. */
  @Roles('ADMIN') @HttpCode(200)
  @Post(API_ROUTES.admin.coachApprove)
  approveCoach(@CurrentUser() actor: AuthUser, @Param('id', { schema: IdSchema }) id: string) {
    return this.approvals.approve(actor.id, id);
  }
}
