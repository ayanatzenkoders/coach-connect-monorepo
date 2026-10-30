import { Injectable } from '@nestjs/common';
import type { AdminStats } from '@coach-connect/shared';
import { PrismaService } from '../prisma/prisma.service.js';

const DAY_MS = 86_400_000;
const CHART_DAYS = 14;

/**
 * The numbers for the admin dashboard. Read-only: every figure is a COUNT the database computes, so nothing is loaded
 * into memory. Staff (SUPPORT/ADMIN) and deleted accounts are never counted: the question is "how is the product doing".
 */
@Injectable()
export class AdminStatsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(now: Date = new Date()): Promise<AdminStats> {
    const weekAgo = new Date(now.getTime() - 7 * DAY_MS);
    const dayAgo = new Date(now.getTime() - DAY_MS);
    // The people we count: real accounts that are not staff and not deleted.
    const people = { deletedAt: null, role: { in: ['MEMBER', 'COACH'] as ('MEMBER' | 'COACH')[] } };

    const [members, approvedCoaches, pendingCoaches, unverified, banned, last7Days, direct, group, active7Days, messages24h, messages7d, waiting, daily] = await Promise.all([
      this.prisma.user.count({ where: { ...people, role: 'MEMBER' } }),
      this.prisma.user.count({ where: { ...people, role: 'COACH', coachProfile: { is: { approved: true } } } }),
      // A coach is pending until approved, including one with no profile row yet (same rule as the user list).
      this.prisma.user.count({ where: { ...people, role: 'COACH', NOT: { coachProfile: { is: { approved: true } } } } }),
      this.prisma.user.count({ where: { ...people, emailVerifiedAt: null } }),
      this.prisma.user.count({ where: { ...people, bannedAt: { not: null } } }),
      this.prisma.user.count({ where: { ...people, createdAt: { gte: weekAgo } } }),
      this.prisma.chat.count({ where: { type: 'DIRECT' } }),
      this.prisma.chat.count({ where: { type: 'GROUP' } }),
      this.prisma.chat.count({ where: { messages: { some: { createdAt: { gte: weekAgo } } } } }),
      this.prisma.message.count({ where: { createdAt: { gte: dayAgo } } }),
      this.prisma.message.count({ where: { createdAt: { gte: weekAgo } } }),
      this.prisma.user.findMany({
        where: { ...people, role: 'COACH', NOT: { coachProfile: { is: { approved: true } } }, bannedAt: null },
        orderBy: { id: 'asc' }, // uuid v7 = time-ordered: oldest application first
        take: 5,
        select: { id: true, name: true, email: true, createdAt: true },
      }),
      this.signupsPerDay(now),
    ]);

    return {
      users: { members, approvedCoaches, pendingCoaches, unverified, banned },
      signups: { last7Days, daily },
      chats: { direct, group, active7Days },
      messages: { last24Hours: messages24h, last7Days: messages7d },
      awaitingApproval: waiting.map((u) => ({ id: u.id, name: u.name, email: u.email, createdAt: u.createdAt.toISOString() })),
    };
  }

  /** One number per UTC day for the last 14 days. generate_series makes the empty days appear with 0 instead of being missing. */
  private async signupsPerDay(now: Date): Promise<{ date: string; count: number }[]> {
    const today = now.toISOString().slice(0, 10);
    const rows = await this.prisma.$queryRaw<{ day: string; count: number }[]>`
      SELECT to_char(d.day, 'YYYY-MM-DD') AS day, COUNT(u.id)::int AS count
      FROM generate_series(${today}::date - ${CHART_DAYS - 1}::int, ${today}::date, interval '1 day') AS d(day)
      LEFT JOIN users u
        ON (u.created_at AT TIME ZONE 'UTC')::date = d.day::date
       AND u.deleted_at IS NULL AND u.role IN ('MEMBER', 'COACH')
      GROUP BY d.day
      ORDER BY d.day`;
    return rows.map((r) => ({ date: r.day, count: r.count }));
  }
}
