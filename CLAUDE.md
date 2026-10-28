# CLAUDE.md

Read [knowledge.md](knowledge.md) before changing anything: it records why the code is the way it is. Project layout and
conventions follow the Zenkoders boilerplate (`mono-repo` branch): pnpm + Turborepo, `apps/*`, `packages/*`.

## Rules

1. **Mobile performance comes first** for anything in `apps/mobile` or `packages/shared`: startup time, JS-thread frame budget,
   re-renders, bundle size. If a request would make the app slower, say so and offer the faster option.
2. **pnpm only, from the repo root.** Never run `npm install` inside an app. Before finishing, run `pnpm turbo typecheck lint test`
   (and `pnpm test:e2e` in `apps/api` when the API changed).
3. **`packages/shared` is the contract.** A new route = its path in `API_ROUTES` + its zod schema in `schemas/` + its response type
   in `types.ts`, before touching API or apps. Mobile imports subpaths (`@coach-connect/shared/api`, `/constants`, `/types`), never the
   root barrel (Metro does not tree-shake, zod would land in the bundle).
4. Navigation in the mobile app is `@react-navigation/native-stack` only.
5. No secrets in the apps. `.env` files are never committed; `.env.example` is.
6. Do not edit an applied Prisma migration; add a new one. Partial indexes and CHECK constraints are hand-written in the migration SQL.
7. When you change architecture, dependencies or conventions, update `knowledge.md` in the same change.
8. `Requirement & Design/` stays local (git-ignored). Do not commit it.
9. Commit messages in the boilerplate's style: `` `feat`: ``, `` `fix`: ``, `` `patch`: ``. The owner makes the commits; do not run `git add/commit/push`.
