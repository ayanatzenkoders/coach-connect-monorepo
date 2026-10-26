# Coach Connect admin panel

Web panel for Admin and Support staff (Next.js, TypeScript). In production it is built as plain static
files (`npm run build` -> `out/`) that the NestJS backend serves.

```bash
npm install
npm run dev        # http://localhost:3001  (forwards /api/* to the backend on port 3000)
npm test           # unit tests
npm run typecheck && npm run lint
```
Sign in with a seeded staff account (see `knowledge.md`): `admin@coachconnect.dev` / `Password123!`.
