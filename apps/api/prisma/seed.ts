import 'dotenv/config';
import * as argon2 from 'argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

// DEV DATA ONLY. Refuses to run in production.
if (process.env.NODE_ENV === 'production') throw new Error('Refusing to seed production.');

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, options: '-c timezone=UTC' }) });
const DEV_PASSWORD = 'Password123!';

async function main() {
  const passwordHash = await argon2.hash(DEV_PASSWORD, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  const month = new Date(Date.now() + 30 * 86_400_000);

  const staff = [
    { email: 'admin@coachconnect.dev', name: 'Noor Haddad', role: 'ADMIN' as const },
    { email: 'support@coachconnect.dev', name: 'Sam Support', role: 'SUPPORT' as const },
  ];
  for (const s of staff) {
    await prisma.user.upsert({
      where: { id: await idFor(s.email) },
      update: {},
      create: { ...s, passwordHash, emailVerifiedAt: new Date() },
    });
  }

  const coaches = [
    { email: 'amara@coachconnect.dev', name: 'Amara Okafor', specialties: ['Career transitions', 'New managers'], available: true },
    { email: 'marcus@coachconnect.dev', name: 'Marcus Bell', specialties: ['Salary talks', 'Promotion cases'], available: true },
    { email: 'lena@coachconnect.dev', name: 'Lena Fischer', specialties: ['Burnout', 'Work-life balance'], available: false },
  ];
  for (const c of coaches) {
    const user = await prisma.user.upsert({
      where: { id: await idFor(c.email) },
      update: {},
      create: { email: c.email, name: c.name, role: 'COACH', passwordHash, emailVerifiedAt: new Date() },
    });
    await prisma.coachProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id, bio: `${c.name} helps people grow in their careers.`, specialties: c.specialties, approved: true, available: c.available },
    });
  }

  const members = ['Sara Malik', 'Jonah Park', 'Rhea Kapoor', 'Omar Saleh', 'Ivy Chen', 'Leo Martins', 'Nia Johnson', 'Tariq Aziz'];
  for (const name of members) {
    const email = `${name.split(' ')[0]!.toLowerCase()}@coachconnect.dev`;
    const user = await prisma.user.upsert({
      where: { id: await idFor(email) },
      update: {},
      create: { email, name, role: 'MEMBER', passwordHash, emailVerifiedAt: new Date() },
    });
    await prisma.subscription.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id, status: 'ACTIVE', plan: 'yearly', expiresAt: month },
    });
  }
  console.log(`Seeded. Every account password: ${DEV_PASSWORD}`);
}

/** Email has no plain unique index (it is a partial one), so we look up the id by email. */
async function idFor(email: string): Promise<string> {
  const existing = await prisma.user.findFirst({ where: { email, deletedAt: null }, select: { id: true } });
  return existing?.id ?? '00000000-0000-0000-0000-000000000000'; // no match -> upsert creates
}

main().finally(() => prisma.$disconnect());
