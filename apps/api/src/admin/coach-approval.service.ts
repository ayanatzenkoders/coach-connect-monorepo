import { Injectable, Logger } from '@nestjs/common';
import type { CoachApprovalResult } from '@coach-connect/shared';
import { AuditService } from '../audit/audit.service.js';
import { AppException } from '../common/errors/app.exception.js';
import { MailerService } from '../mail/mailer.service.js';
import { coachApprovedEmail } from '../mail/templates.js';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Approving a coach is what makes them visible: People and new chats only list coaches whose profile has
 * `approved = true`. There is no "un-approve": to take a coach away, an admin BANS them (they disappear from People,
 * their old chats stay readable, nobody can write to them). An admin's write, so the audit entry is saved in the SAME
 * transaction as the change.
 */
@Injectable()
export class CoachApprovalService {
  private readonly log = new Logger(CoachApprovalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly mailer: MailerService,
  ) {}

  async approve(actorId: string, coachId: string): Promise<CoachApprovalResult> {
    const result = await this.save(actorId, coachId);
    // The email goes out AFTER the transaction committed (like every push): a mail problem must never undo the approval.
    if (result.changed) await this.tellCoach(coachId);
    return result;
  }

  /** "You can now sign in". If the email cannot be sent the coach is still approved; we only log it. */
  private async tellCoach(coachId: string): Promise<void> {
    try {
      const coach = await this.prisma.user.findUniqueOrThrow({ where: { id: coachId }, select: { email: true, name: true } });
      await this.mailer.send({ to: coach.email, ...coachApprovedEmail(coach.name) });
    } catch (e) {
      this.log.error(`Could not send the approval email: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  private save(actorId: string, coachId: string): Promise<CoachApprovalResult> {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findFirst({ where: { id: coachId, deletedAt: null }, select: { role: true, coachProfile: { select: { approved: true } } } });
      if (!user) throw new AppException(404, 'USER_NOT_FOUND', 'User not found.');
      if (user.role !== 'COACH') throw new AppException(400, 'NOT_A_COACH', 'Only coach accounts can be approved.');

      // Asking again for a coach who is already approved is not an error and leaves no audit entry.
      if (user.coachProfile?.approved) return { isApproved: true, changed: false };

      // upsert: a coach whose profile row was never created gets one now.
      await tx.coachProfile.upsert({ where: { userId: coachId }, create: { userId: coachId, approved: true }, update: { approved: true } });
      await this.audit.record({ actorId, action: 'coach.approve', targetType: 'user', targetId: coachId }, tx);
      return { isApproved: true, changed: true };
    });
  }
}
