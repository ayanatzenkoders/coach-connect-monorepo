import { Injectable } from '@nestjs/common';
import { AppException } from '../common/errors/app.exception.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class CoachesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Set my own "Available now". It only ever touches MY profile row (the id comes from the token, never from the body).
   * Saying the same thing twice is harmless. A coach who is not approved has no say yet: they are not in People at all.
   */
  async setAvailability(coachId: string, available: boolean): Promise<{ available: boolean }> {
    const changed = await this.prisma.coachProfile.updateMany({ where: { userId: coachId, approved: true }, data: { available } });
    if (changed.count === 0) throw new AppException(403, 'COACH_PENDING_APPROVAL', 'Your application is waiting for approval.');
    return { available };
  }
}
