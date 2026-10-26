# Coach Connect

Subscription app where members talk to coaches by audio/video call and chat, with AI call summaries.

A **pnpm + Turborepo monorepo** (same layout as the Zenkoders boilerplate):

| Path | What | Stack |
|------|------|-------|
| `apps/mobile` | iOS + Android app | React Native CLI (bare), TypeScript, React Navigation (native stack), React Query, Zustand |
| `apps/api` | API, realtime, jobs | NestJS 12, Prisma, Postgres, zod validation |
| `apps/web` | Admin panel | Next.js (static export in production) |
| `packages/shared` | Code every app uses: zod schemas, the API route list, response types | zod, tsup |
| `packages/tsconfig` | Shared TypeScript settings | |
| `Requirement & Design/` | PRD, UI design, plans (never pushed) | docs |

Start with `knowledge.md` (the why behind everything) and `CLAUDE.md` (the rules for changing it).

## Local setup
1. Install tools: Node >= 22.13, then `corepack enable` (gives you pnpm 10).
2. Database: either `docker compose up -d`, or Homebrew: `brew install postgresql@16 && brew services start postgresql@16` then create role `coach` (password in `apps/api/.env.example`) and database `coachconnect`
3. Install: `pnpm install` (once, at the repo root)
4. API: `cd apps/api && cp .env.example .env && pnpm prisma:migrate && pnpm db:seed && pnpm dev`
5. Mobile: `cd apps/mobile/ios && pod install && cd .. && pnpm dev` (Metro), then `pnpm ios` in another terminal

Everything at once from the root: `pnpm turbo typecheck lint test`.
