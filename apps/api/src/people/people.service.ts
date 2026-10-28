import { BadRequestException, Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { PeopleQueryParsed } from '@coach-connect/shared';

@Injectable()
export class PeopleService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The People screen: everyone I am allowed to see, as coaches or as members.
   * Hidden from the list: myself, banned or deleted accounts, and anyone I blocked or who blocked me.
   * Coaches also need to be approved by an Admin.
   * Deliberately NOT returned: email, subscription, anything private (decision D9).
   */
  async list(me: string, query: PeopleQueryParsed) {
    const isCoaches = query.kind === 'coaches';
    const filters: Prisma.UserWhereInput[] = [
      {
        role: isCoaches ? 'COACH' : 'MEMBER',
        id: { not: me },
        bannedAt: null,
        deletedAt: null,
        // "I blocked them" and "they blocked me" both hide the person.
        blocksReceived: { none: { blockerId: me } },
        blocksMade: { none: { blockedId: me } },
      },
    ];
    if (isCoaches) {
      filters.push({
        coachProfile: {
          is: {
            approved: true,
            ...(query.specialty ? { specialties: { has: query.specialty } } : {}),
            ...(query.available ? { available: true } : {}),
          },
        },
      });
    }
    // ILIKE '%text%' (the user's own % and _ are escaped so they are plain characters): served by the trigram index on users.name (see the migration).
    if (query.q) filters.push({ name: { contains: escapeLike(query.q), mode: 'insensitive' } });
    // The total counts everything that matches the filters, ignoring which page we are on.
    const where: Prisma.UserWhereInput = { AND: filters };

    // Keyset paging: "everyone after the last (name, id) I saw". Unlike OFFSET it stays fast on
    // page 50 and never repeats or skips people when the list changes between requests.
    const after = query.cursor ? decodeCursor(query.cursor) : undefined;
    const pageWhere: Prisma.UserWhereInput = after
      ? { AND: [...filters, { OR: [{ name: { gt: after.name } }, { name: after.name, id: { gt: after.id } }] }] }
      : where;

    const [found, total] = await Promise.all([
      this.prisma.user.findMany({
        where: pageWhere,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        take: query.limit + 1, // one extra row tells us whether another page exists
        select: {
          id: true,
          name: true,
          role: true,
          coachProfile: { select: { bio: true, specialties: true, available: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);
    const hasMore = found.length > query.limit;
    const rows = hasMore ? found.slice(0, query.limit) : found;
    const last = rows[rows.length - 1];
    const nextCursor = hasMore && last ? encodeCursor(last.name, last.id) : null;

    // The specialty chips on the Coaches tab: every specialty an approved coach offers.
    const specialties = isCoaches ? await this.coachSpecialties() : undefined;

    return {
      total,
      nextCursor,
      ...(specialties && { specialties }),
      items: rows.map((u) => ({
        id: u.id,
        name: u.name,
        role: u.role,
        ...(u.coachProfile && {
          bio: u.coachProfile.bio,
          specialties: u.coachProfile.specialties,
          available: u.coachProfile.available,
        }),
      })),
    };
  }

  /** Distinct specialties of visible coaches, A to Z. `unnest` turns each coach's array into rows. */
  private async coachSpecialties(): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<{ s: string }[]>`
      SELECT DISTINCT unnest(cp.specialties) AS s
      FROM coach_profiles cp
      JOIN users u ON u.id = cp.user_id
      WHERE cp.is_approved AND u.banned_at IS NULL AND u.deleted_at IS NULL
      ORDER BY s`;
    return rows.map((r) => r.s);
  }
}

const encodeCursor = (name: string, id: string) => Buffer.from(JSON.stringify({ name, id })).toString('base64url');

function decodeCursor(cursor: string): { name: string; id: string } {
  try {
    const value = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as { name?: unknown; id?: unknown };
    if (typeof value.name === 'string' && typeof value.id === 'string') return { name: value.name, id: value.id };
  } catch {
    // fall through
  }
  throw new BadRequestException('Invalid cursor.');
}

/** In LIKE patterns % and _ are wildcards; a backslash in front makes them literal. */
const escapeLike = (text: string) => text.replace(/[\\%_]/g, '\\$&');
