# apps/api

Read the root [knowledge.md](../../knowledge.md) sections 4-7 first (database, auth, RBAC, bans) and 5.3 (how a route is defined).

- Validate every input with a zod schema from `@coach-connect/shared`, named on the decorator: `@Body({ schema: LoginInputSchema }) dto: LoginInput`. No class-validator DTO classes.
- Route paths come from `API_ROUTES` (`@Post(API_ROUTES.auth.login)`); add new paths and schemas to `packages/shared` first.
- New env vars: add them to `src/config/env.ts` (zod) and `.env.example`; read them through `ConfigService<Env, true>`.
- One folder per feature (`<feature>.module.ts`, `.controller.ts`, `.service.ts`). Controllers stay thin; every route is protected unless marked `@Public()`.
- ESM: relative imports end in `.js`. Prisma schema changes: new migration, hand-written SQL for partial indexes and CHECKs.
- Every admin write goes through a service that writes an audit row in the same transaction.
- Run: `pnpm dev`, `pnpm typecheck`, `pnpm lint`, `pnpm test` (unit), `pnpm test:e2e` (integration, uses the `coachconnect_test` database).
