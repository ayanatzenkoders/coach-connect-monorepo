import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Prisma 7 reads the database URL here (not in schema.prisma).
// Tests set DATABASE_URL to the coachconnect_test database.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
