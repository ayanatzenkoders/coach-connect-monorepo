# Coach Connect mobile app (`apps/mobile`)

Bare React Native 0.88 (TypeScript). Folder layout, screen pattern and test setup: root `knowledge.md` (section 8b).

```bash
cd ios && pod install && cd ..   # once, and after changing native dependencies
pnpm dev                         # Metro
pnpm ios                         # build and run on the simulator (the API must run on port 3000)
pnpm typecheck && pnpm lint && pnpm test
pnpm icons                       # regenerate the app icons from scripts/generate-icons.mjs
```
Sign in with `sara@coachconnect.dev` / `Password123!` (from the API seed).
