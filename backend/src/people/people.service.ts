import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { PeopleQueryDto } from './people.dto.js';

@Injectable()
export class PeopleService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The People screen: everyone I am allowed to see, as coaches or as members.
   * Hidden from the list: myself, banned or deleted accounts, and anyone I blocked or who blocked me.
   * Coaches also need to be approved by an Admin.
   * Deliberately NOT returned: email, subscription, anything private (decision D9).
   */
  async list(me: string, query: PeopleQueryDto) {
    const where: Prisma.UserWhereInput = {
      role: query.kind === 'coaches' ? 'COACH' : 'MEMBER',
      id: { not: me },
      isBanned: false,
      deletedAt: null,
      // "I blocked them" and "they blocked me" both hide the person.
      blocksReceived: { none: { blockerId: me } },
      blocksMade: { none: { blockedId: me } },
      ...(query.kind === 'coaches' ? { coachProfile: { is: { approved: true } } } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        take: query.limit,
        select: {
          id: true,
          name: true,
          role: true,
          coachProfile: { select: { bio: true, specialties: true, available: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      total,
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
}
