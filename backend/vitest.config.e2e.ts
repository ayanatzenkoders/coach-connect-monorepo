import { defineConfig } from 'vitest/config';

// Integration tests: boot the real Nest app against the coachconnect_test database.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    fileParallelism: false, // tests share one database
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://coach:coach_dev_password@localhost:5432/coachconnect_test',
      JWT_ACCESS_SECRET: 'test-secret-test-secret-test-secret-123456',
    },
  },
});
