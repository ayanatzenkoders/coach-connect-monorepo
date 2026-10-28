import { Injectable } from '@nestjs/common';
import type { AdminUser, AdminUsersPage, AdminUsersQueryParsed } from '@coach-connect/shared';
import { escapeLike } from '../common/db/escape-like.js';
import type { Prisma, Role } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** The user list of the admin panel (read-only: Support and Admin may both see it). */
@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** `viewerRole`: the phone number is for ADMINs only (Support sees everything else). */
  async list(query: AdminUsersQueryParsed, viewerRole: Role = 'ADMIN'): Promise<AdminUsersPage> {
    // Every filter is one entry of AND, so they combine: "coaches" + "waiting for approval" + "named ana".
    const and: Prisma.UserWhereInput[] = [{ deletedAt: null }];
    if (query.role) and.push({ role: query.role });
    if (query.status === 'banned') and.push({ bannedAt: { not: null } });
    // A coach is "pending" until an admin approves them, including one who has no profile row yet.
    if (query.status === 'pending') and.push({ role: 'COACH', NOT: { coachProfile: { is: { approved: true } } } });
    // Signed up but never typed the code from the email.
    if (query.status === 'unverified') and.push({ emailVerifiedAt: null });
    if (query.q) {
      // escapeLike: the typed % and _ are searched literally instead of acting as wildcards.
      const text = escapeLike(query.q);
      and.push({ OR: [{ name: { contains: text, mode: 'insensitive' } }, { email: { contains: text, mode: 'insensitive' } }] });
    }
    // Ids are uuid v7 (time-ordered), so "newest first" is just "id descending" and the cursor is the last id.
    // Unlike OFFSET, page 50 costs the same as page 1 and nobody repeats or disappears when the list changes.
    if (query.cursor) and.push({ id: { lt: query.cursor } });

    const rows = await this.prisma.user.findMany({
      where: { AND: and },
      orderBy: { id: 'desc' },
      take: query.limit + 1, // one extra row tells us whether another page exists
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        phone: true,
        dateOfBirth: true,
        emailVerifiedAt: true,
        bannedAt: true,
        createdAt: true,
        coachProfile: { select: { approved: true, bio: true, specialties: true } },
      },
    });

    const more = rows.length > query.limit;
    const page = more ? rows.slice(0, query.limit) : rows;
    const items: AdminUser[] = page.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      bannedAt: u.bannedAt?.toISOString() ?? null,
      // Only coaches have an approval. A coach with no profile row counts as not approved.
      isApproved: u.role === 'COACH' ? (u.coachProfile?.approved ?? false) : null,
      emailVerified: u.emailVerifiedAt !== null,
      phone: viewerRole === 'ADMIN' ? u.phone : null,
      dateOfBirth: u.dateOfBirth?.toISOString().slice(0, 10) ?? null,
      coach: u.role === 'COACH' ? { bio: u.coachProfile?.bio ?? '', specialties: u.coachProfile?.specialties ?? [] } : null,
      createdAt: u.createdAt.toISOString(),
    }));
    return { items, nextCursor: more ? page[page.length - 1]!.id : null };
  }
}
