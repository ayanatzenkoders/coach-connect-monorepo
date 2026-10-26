# Coach Connect API (`apps/api`)

NestJS 12 + Prisma 7 + Postgres. Validation, routes and response types come from `packages/shared`.

```bash
cp .env.example .env     # then set JWT_ACCESS_SECRET (openssl rand -base64 48)
pnpm prisma:migrate && pnpm db:seed
pnpm dev                 # http://localhost:3000/health  (OpenAPI page: /docs)
pnpm test                # unit tests
pnpm test:e2e            # integration tests (coachconnect_test database)
pnpm mail:test you@example.com   # send a test email with the MAIL_* settings from .env
```
Why things are the way they are: root `knowledge.md` (sections 4-7). Rules for changes: `CLAUDE.md`.
