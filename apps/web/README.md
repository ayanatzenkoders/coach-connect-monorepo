# Coach Connect admin panel (`apps/web`)

Web panel for Admin and Support staff (Next.js App Router, TypeScript). In production it is built as plain
static files (`pnpm build` -> `out/`) that the NestJS API serves.

```bash
pnpm dev           # http://localhost:3001  (forwards /api/* to the API on port 3000)
pnpm test          # unit tests
pnpm typecheck && pnpm lint
```
Sign in with a seeded staff account: `admin@coachconnect.dev` / `Password123!`.
More in the root `knowledge.md` (section 8c).
