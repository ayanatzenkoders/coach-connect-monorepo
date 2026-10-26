import type { INestApplication } from '@nestjs/common';
import { createApp, resetDb } from './helpers.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

// Regression test: times the app writes must be the same instant Postgres sees.
// Before the fix, on a machine in UTC+5 a timestamp written "now" was stored 5 hours in the past.
describe('Timestamps', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
  });
  afterAll(() => app.close());
  beforeEach(() => resetDb(prisma));

  it('app-written times match the database clock', async () => {
    const row = await prisma.auditLog.create({ data: { action: 'tz.test', createdAt: new Date() } });
    const [{ age }] = await prisma.$queryRaw<{ age: number }[]>`
      select extract(epoch from now() - created_at)::float8 as age from audit_log where id = ${row.id}::uuid`;
    expect(Math.abs(age)).toBeLessThan(5);
  });
});
