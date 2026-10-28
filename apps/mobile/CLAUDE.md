# apps/mobile

Read the root [knowledge.md](../../knowledge.md) section 8b first (folders, screen pattern, test setup).

- Folder layout: `src/{components,constants,navigations,screens,service,store,utils}`. Screens are `screens/<module>/<screen>/<Screen>.tsx` (UI only) + `hook/use<Screen>.tsx` (all logic).
- Shared UI is `components/common/Custom<Name>/index.tsx` + `interface.ts`, exported from `src/components/index.ts`. Import with the alias: `@/src/components`.
- Theme: `COLORS`, `SPACING`, `RADIUS`, `TEXT` from `@/src/constants`. No raw hex values in screens.
- Lists use `FlatList` today; use `keyExtractor`, stable `renderItem`, and `StyleSheet.create` (no inline style objects).
- Zustand: select what you need (`useAuthStore((s) => s.status)`), never `useAuthStore()`.
- API calls: a function in `service/api/<domain>.api.ts` (typed with `@coach-connect/shared/types`, path from `API_ROUTES`), called through `withAuth` when logged in. Screens/hooks show failures with `showApiError`.
- Native module versions are pinned exactly; bump on purpose, then `cd ios && pod install`.
- Run: `pnpm dev` (Metro), `pnpm ios`, `pnpm typecheck`, `pnpm lint`, `pnpm test`.
