import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

type Db = Pick<PrismaService, 'auditLog'> | Prisma.TransactionClient;

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /** Pass a transaction client as `db` so the audit row commits or rolls back with the action. */
  record(
    entry: {
      actorId?: string | null;
      action: string;
      targetType?: string;
      targetId?: string;
      metadata?: Prisma.InputJsonValue;
    },
    db: Db = this.prisma,
  ) {
    return db.auditLog.create({ data: entry });
  }
}
