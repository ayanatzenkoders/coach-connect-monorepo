import { Module } from '@nestjs/common';
import { ModerationModule } from '../moderation/moderation.module.js';
import { AdminController } from './admin.controller.js';
import { AdminStatsService } from './admin-stats.service.js';
import { AdminUsersService } from './admin-users.service.js';
import { CoachApprovalService } from './coach-approval.service.js';

@Module({ imports: [ModerationModule], controllers: [AdminController], providers: [AdminUsersService, AdminStatsService, CoachApprovalService] })
export class AdminModule {}
