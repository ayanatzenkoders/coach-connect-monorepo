# Coach Connect: Project Knowledge Base

The "why and how" of this codebase. Code shows *what*; this file explains *why* and records what we learned.

**Maintenance rule:** at the end of every phase (or when a decision/bug teaches something), add to the right section and
add a line to the [Changelog](#13-changelog). Keep entries short. If something here becomes wrong, fix or delete it.

Related docs: `Requirement & Design/Coach Connect Detailed Plan.md` (what to build, step by step).

---

## 1. Repo map (monorepo)

We follow the Zenkoders boilerplate layout (`mobile-app-boilerplate`, branch `mono-repo`): **pnpm workspaces + Turborepo**.

| Path | What |
|------|------|
| `apps/mobile` | React Native CLI app (TypeScript). iOS + Android. Package `@coach-connect/mobile`. |
| `apps/api` | NestJS API (TypeScript, ESM). Prisma + Postgres. Package `@coach-connect/api`. |
| `apps/web` | Next.js admin panel (TypeScript). Package `@coach-connect/web`. |
| `packages/shared` | `@coach-connect/shared`: zod schemas, `API_ROUTES`, response types, plain constants. Built with tsup to ESM + CJS. |
| `packages/tsconfig` | `@coach-connect/tsconfig`: base `tsconfig`. |
| `docker-compose.yml` | Local Postgres for people who use Docker. Bound to `127.0.0.1` only. |
| `Requirement & Design/` | PRD, UI design export, implementation plans (git-ignored, never pushed). |
| `knowledge.md` / `CLAUDE.md` | This file (why + lessons) and the rules for changing the code. |

### 1.1 Monorepo conventions
- **pnpm 10** (`packageManager` in the root `package.json`; get it with `corepack enable`), `node-linker=hoisted` in `.npmrc` because React Native tooling (Metro, autolinking, CocoaPods) expects a flat `node_modules`. Install once, at the repo root. Never run `npm install` inside an app.
- **Turborepo** runs the same script names everywhere: `dev`, `build`, `lint`, `typecheck`, `test`, `clean`. `pnpm turbo typecheck lint test` checks the whole repo; `turbo` builds `packages/shared` first (`^build`).
- **One version for shared libraries** lives in the pnpm *catalog* (`pnpm-workspace.yaml`): `"zod": "catalog:"`. React is pinned to ONE version (19.3.0) for web and mobile.
- **`@coach-connect/shared` is the contract between apps.** The API validates requests with its zod schemas, the mobile forms and the web panel use the same route list and types. Import **subpaths** on mobile (`/api`, `/constants`, `/types`): Metro does not tree-shake, so the root barrel would add zod to the app for a single constant.
- **Only what is used is installed.** `apps/mobile` lists just the libraries its code imports (section 1.2 has what was removed and how to bring it back). Native module versions that CocoaPods is picky about get pinned exactly when they are added.
- Ports stay as before: API 3000, web 3001, Metro 8081 (the boilerplate uses 4000/3000).

### 1.2 Removed on purpose (add back with the feature that needs it)
A cleanup pass removed everything nothing imported. Each item returns with its phase; add it with `pnpm --filter @coach-connect/mobile add <pkg>@<version>`, then `cd apps/mobile/ios && pod install`.

| Removed | Was for | Last version here |
|---|---|---|
| `@livekit/react-native`, `@livekit/react-native-webrtc`, `livekit-client` | Calls (Phase 3) | 3.1.0, **150.1.0 (pin it: 150.1.1 needs a WebRTC pod we could not install)**, 2.23.0 |
| `react-native-callkeep`, `react-native-voip-push-notification` | Ringing a locked phone (Phase 5) | 4.6.1, 3.3.3 |
| `@react-native-firebase/app`, `/messaging`, `@notifee/react-native` | Push notifications (Phase 5). Firebase v27 needs dynamic frameworks: set `linkage = ENV['USE_FRAMEWORKS'] \|\| 'dynamic'` in the Podfile | 27.0.0, 27.0.0, 9.1.8 |
| `socket.io-client` | Real-time chat and call events (Phase 7) | 4.8.4 |
| `@op-engineering/op-sqlite` | Offline message outbox (Phase 7) | 18.2.5 |
| `react-native-purchases` | Subscriptions (Phase 6) | 10.15.1 |
| `@sentry/react-native` | Crash reporting (Phase 10) | 8.32.0 |
| `@react-native-google-signin/google-signin`, `@invertase/react-native-apple-authentication` | Google / Apple sign-in | 16.1.5, 2.5.1 |
| `react-native-image-picker` | Chat images / avatars. It needs `-framework UniformTypeIdentifiers -framework MobileCoreServices` in the Podfile `post_install` when frameworks are dynamic | 8.3.0 |
| `@react-navigation/bottom-tabs`, `@react-native/new-app-screen`, `@babel/preset-env` | Not used (the tab bar is hand-made; template leftovers) | |
| API: `@nestjs/event-emitter` + the `user.banned` / `chat.message.created` events | Nothing listened to them. Add back with sockets / calls | |
| API: table `push_tokens` + enum `PushPlatform` (and "a ban deletes the user's push tokens") | Push notifications. Re-add with a migration, and make `BanService.ban` delete the tokens in its transaction | |
| API: `subscriptions.source`, `subscriptions.last_event_id` + enum `SubscriptionSource` | RevenueCat webhook (Phase 6) | |
| API: `@nestjs/mau` (`nest deploy`), `source-map-support`, `@vitest/coverage-v8`, explicit `pg` / `@types/pg` (`@prisma/adapter-pg` brings its own) | Template leftovers | |
| `.env.example`: `LIVEKIT_*`, `MAX_GUESTS_PER_COACH_CALL` | Calls | |
| Root prettier config and `pnpm format` | It formatted with double quotes while the code uses single quotes. `apps/api` keeps its own prettier config and `pnpm format` | |

## 2. Run it locally

```bash
corepack enable                                                      # once: gives you pnpm
brew install postgresql@16 && brew services start postgresql@16     # or: docker compose up -d   (then create role/db once, see below)

pnpm install                                   # once, at the repo root (also runs `prisma generate`)
cd apps/api
cp .env.example .env                           # then set JWT_ACCESS_SECRET:  openssl rand -base64 48
pnpm prisma:migrate                            # creates/updates tables
pnpm db:seed                                   # dev users; every password is Password123!
pnpm dev                                       # http://localhost:3000/health   (OpenAPI page: /docs)

# Mobile (two terminals)
cd apps/mobile/ios && pod install && cd ..     # once, and after changing native dependencies
pnpm dev                                       # Metro
pnpm ios                                       # build + run on the simulator

# Tests
pnpm turbo typecheck lint test                 # everything (unit tests only; no database needed)
cd apps/api && pnpm test:e2e                   # integration tests (uses the coachconnect_test DB)
```

Seeded logins (password `Password123!`): `admin@coachconnect.dev` (ADMIN, use `/admin/auth/login`), `support@coachconnect.dev` (SUPPORT),
coaches `amara@`, `marcus@`, `lena@coachconnect.dev`, members `sara@`, `jonah@`, `rhea@`, `omar@`, `ivy@`, `leo@`, `nia@`, `tariq@coachconnect.dev` (members have an ACTIVE subscription).

One-time local DB setup (Homebrew):
```sql
CREATE ROLE coach WITH LOGIN PASSWORD 'coach_dev_password' CREATEDB;  -- CREATEDB: Prisma makes a temp "shadow" DB for migrations
CREATE DATABASE coachconnect OWNER coach;
CREATE DATABASE coachconnect_test OWNER coach;                         -- used only by integration tests
```
Then once: `DATABASE_URL=postgresql://coach:coach_dev_password@localhost:5432/coachconnect_test pnpm prisma migrate deploy` (from `apps/api`).

## 3. Tooling gotchas we hit (save yourself the time)

| Symptom | Cause / fix |
|---------|-------------|
| `pod install` crashes with `Unicode Normalization not appropriate for ASCII-8BIT` | Run with `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8`. |
| `pnpm install` says "Ignored build scripts" | pnpm 10 blocks install scripts. Allow-listed ones are in `pnpm-workspace.yaml` (`onlyBuiltDependencies`: argon2, prisma, esbuild...). Add a package there only if it really needs its script. |
| `tsup` fails with TS5101 `baseUrl is deprecated` | TypeScript 6. `packages/tsconfig/base.json` sets `"ignoreDeprecations": "6.0"`. |
| `pod install`: "could not find compatible versions for LiveKitWebRTC" | (When calls are added back.) Pin `@livekit/react-native-webrtc` to 150.1.0; 150.1.1 wants a WebRTC pod we could not fetch. |
| Jest: "Unexpected token 'export'" from `@react-navigation` | It ships ES modules. `apps/mobile/jest.config.js` adds `@react-navigation` to `transformIgnorePatterns`. |
| `npx prisma` shows a totally different CLI (v8 rc) | Run Prisma through the project: `pnpm prisma ...` inside `apps/api` (pinned to 7.10.1, same as `@prisma/client`). A bare `npx prisma` outside `apps/api` downloads npm's `latest`, a release candidate. |
| `zsh: command not found: psql -h ...` | zsh does not word-split a variable holding a command. Use a shell function, not a string variable. |
| `curl -H $J` sends no JSON content type in zsh | Same reason. Quote headers inline: `-H "Content-Type: application/json"`. |
| Nest 12 template uses **Vitest** (not Jest) and ESM | Imports need the `.js` suffix even in `.ts` files. Test globals work (`describe`, `it`). |
| `EADDRINUSE: address already in use :::3000` (backend) or `:::8081` (Metro) | An earlier server is still running (often one started in a background session). Find it: `lsof -nP -iTCP:3000 -sTCP:LISTEN`, check the command, then `kill <pid>`. Do the same for 8081 (Metro) and 3001 (admin). Ports: backend 3000, admin 3001, Metro 8081. |
| `pod install` after adding a native package (e.g. `react-native-svg`) | Required, then rebuild the iOS app. Metro hot reload only covers JavaScript. |
| Times stored 5 h off in Postgres (UTC+5 machine) | Prisma sends dates as UTC text without an offset; a non-UTC connection stores the wrong instant. Fixed by `options: '-c timezone=UTC'` in `PrismaPg` (`prisma.service.ts`, `seed.ts`). Regression test: `test/timezone.e2e-spec.ts`. Rows written before the fix in a dev DB are shifted; `pnpm prisma migrate reset` (in `apps/api`) clears them. |
| App stuck on splash, red "required entitlement isn't present" | Keychain needs a SIGNED app. Do not build the simulator app with `CODE_SIGNING_ALLOWED=NO`; use `CODE_SIGN_IDENTITY="-" CODE_SIGNING_ALLOWED=YES` (normal Xcode/`pnpm ios` builds are already signed). The app now also falls back to signed-out instead of hanging if Keychain fails. |
| Next.js 16 template: `cacheComponents` / `partialPrefetching` in `next.config.ts` | Removed: they need a Node server, but production is a static export. Also read `node_modules/next/dist/docs/` before using Next APIs; this version differs from older tutorials. |
| `vitest` (admin) fails with "Cannot find package 'vite'" | Vitest 5 needs `vite` installed next to it (`npm i -D vite`). |
| iOS simulator swallows typing in a password field (only 1 character arrives) | iOS AutoFill suggestion bubble (e.g. an old saved email) sits on top of the field. Tap its "x" to dismiss, then type. Real users just ignore it; not an app bug. |
| Hidden input loses focus after an error | Never call `.focus()` while the input is `editable={false}`. Refocus in an effect once `busy` is false (VerifyEmailScreen). |
| Simulator ignores taps / screen looks stale | Usually a stuck session after a first launch or Metro disconnect ("not responding for 60 seconds" in the Metro log). Terminate and relaunch the app (`xcrun simctl terminate/launch <device> org.reactjs.native.example.CoachConnect`). Capture exact frames with `xcrun simctl io <device> screenshot file.png`. |
| iOS "Save Password?" dialog appears after login in the simulator | Normal iOS autofill prompt (the password field has `textContentType="password"`). Tap "Not Now". It blocks taps until dismissed. |
| iOS simulator screenshots / taps seem to lag | The UI updates a moment after a tap; wait ~1-2 s before judging a screen. |
| Forgot-password email field swallows typing in the simulator | Field had `textContentType="username"` so iOS offered saved logins. Use `emailAddress`. |
| Script run with `tsx` fails env validation / Nest DI | `tsx` has no decorator metadata and passes env numbers as text. Env numbers use explicit `@Type(() => Number)`, and `scripts/send-test-mail.ts` builds `MailerService` by hand instead of booting Nest. |
| `SMTP_SECURE=false` behaved as true | Text "false" is truthy; the setting is read from the raw value (`'true'` only). Covered by a unit test. |
| `apps/api/src/generated/` missing after clone | It is generated, not committed: `pnpm prisma:generate` in `apps/api` (also runs on `pnpm install`). |

---

## 4. Database

Postgres 16. Prisma 7 (schema in `apps/api/prisma/schema.prisma`; connection URL lives in `prisma.config.ts`).
Tables: `users`, `sessions`, `coach_profiles`, `subscriptions`, `blocks`, `one_time_codes`, `conversations`, `messages`, `audit_log`.

### 4.1 Conventions
- **Primary keys: UUID v7** (`@default(uuid(7))`). Time-ordered, so new rows append to the end of the index (faster inserts, less bloat than random v4) and ids cannot be guessed like `1,2,3`.
- **Timestamps are `timestamptz`** (always carry timezone). Never plain `timestamp`.
- **Emails are stored lowercase** (CHECK constraint) and input is lowercased before use.
- **Soft delete** on users via `deleted_at`; "live" queries always include `deleted_at IS NULL`.
- **Raw SQL lives in the migration file** for anything Prisma can't express (marked `RAW`). Prisma does not drop them (verified: `migrate dev` reports "in sync").
- Never edit an applied migration. Add a new one: `pnpm prisma:migrate --name what_changed` (in `apps/api`). Use `--create-only` to hand-edit the SQL first.

### 4.2 Every state, and what it means

**`Role`** (who the account is; decides which APIs/screens)
| Value | Meaning |
|-------|---------|
| `MEMBER` | Paying app user. Calls coaches and other members, chats, can be added to coach calls. Needs a subscription to call. |
| `COACH` | Approved coach. Receives calls. Never needs a subscription. Created/approved by an Admin (no self sign-up). |
| `SUPPORT` | Staff, web panel only, **read-only**. Cannot ban, edit or delete. |
| `ADMIN` | Staff, web panel only, full control including ban/unban. |

**`SessionAudience`**: `MOBILE` (member/coach app) or `ADMIN` (web panel). A mobile token cannot open admin routes.

**`SessionRevokeReason`** (why a login session ended)
| Value | Meaning |
|-------|---------|
| `LOGOUT` | User signed out. |
| `REPLACED` | Same device signed in again; old session closed (one live session per device). |
| `REUSE_DETECTED` | An already-used refresh token came back after the grace window: treated as theft, session killed. |
| `BANNED` | Admin banned the user. |
| `ADMIN_REVOKED` | Admin signed a device out. (reserved) |
| `PASSWORD_CHANGED` | Password change/reset signs out other devices. (reserved) |

**`SubscriptionStatus`** (no row = never subscribed)
| Value | Meaning | Can call? |
|-------|---------|-----------|
| `TRIAL` | In the free trial. | yes |
| `ACTIVE` | Paid and current. | yes |
| `GRACE_PERIOD` | Payment failed, store is still retrying. | yes (for now) |
| `CANCELLED_ACTIVE` | Auto-renew turned off but the paid period hasn't ended. | yes, until `expires_at` |
| `EXPIRED` | Period over or refunded. | **no** |

Implemented in `apps/api/src/subscriptions/subscription-access.ts` (`hasActiveAccess`), unit tested.

**`OneTimeCodePurpose`**: `EMAIL_VERIFICATION` (6-digit code after sign-up) or `PASSWORD_RESET` (used in the next step).

#### States that arrive in later phases (defined now so we agree on the meaning)

**Call state** (`calls.state`, server decides every transition; clients only send intents). Phase 3.
| State | Meaning |
|-------|---------|
| `RINGING` (start) | Call created; callee's devices are ringing. Max 30 s. |
| `ACTIVE` | Someone accepted; media is flowing. |
| `COMPLETED` | Ended normally after being active. |
| `DECLINED` | Callee tapped decline. |
| `BUSY` | Callee already in another call. |
| `CANCELED` | Caller hung up before anyone answered. |
| `MISSED` | 30 s passed with no answer. Triggers a missed-call notification. |
| `FAILED` | Technical failure, e.g. 15 s without media after a network drop. |

**Call kind**: `MEMBER_DIRECT` (member to member, 1:1 only) or `COACH` (member + coach, may grow to 6 people).

**Participant role**: `HOST` (the member who dialled; only they can add people), `COACH`, `GUEST` (added member).

**Participant state** (`call_participants.state`): `INVITED` (chosen, push not yet delivered), `RINGING`, `JOINED`, `DECLINED`, `MISSED` (didn't answer in 30 s), `LEFT`, `REMOVED` (kicked, e.g. banned). Seats count `INVITED + RINGING + JOINED` guests, max 4.

**Consent** (`call_participants.consent`): `UNKNOWN` (not asked/answered yet), `YES`, `NO`. Recording runs only while **everyone currently in the call** is `YES`; a late joiner makes it `UNKNOWN` again until they answer.

**Summary status** (Phase 8): `PENDING` (waiting for the call to end), `TRANSCRIBING`, `SUMMARIZING`, `READY`, `FAILED` (after retry; the app shows a clear message), `NOT_RECORDED` (consent declined, or call too short).

**Report status** (moderation, Phase 9): `OPEN`, `IN_REVIEW`, `RESOLVED`, `DISMISSED`.

### 4.3 Indexes: what, where, why

An index is a sorted lookup structure: instead of reading every row, Postgres jumps to the matching ones. Cost: extra disk and slightly slower writes. So we only index what we actually search by.

**Plain (B-tree) index**: speeds up `WHERE col = x`, ranges and `ORDER BY`. Composite `(a, b)` helps queries on `a` or on `a AND b`, **not** on `b` alone (leftmost-prefix rule).
| Index | Why it exists |
|-------|---------------|
| `sessions(user_id)` | Find all sessions of a user (ban, logout-all, devices screen). Also makes `ON DELETE CASCADE` from users fast. |
| `blocks(blocked_id)` | The primary key `(blocker_id, blocked_id)` serves "who did I block". This reverse index serves "who blocked me", needed for the either-direction check. |
| `audit_log(actor_id, created_at)` | "What did this admin do, newest first." |
| `audit_log(target_type, target_id, created_at)` | "History of this user." |
| `audit_log(created_at)` | Global recent-activity feed. |

**Unique index**: the database guarantees no duplicates (even if two requests race). `subscriptions(user_id)` (one row per user).

**Partial index** (`... WHERE condition`): indexes **only the rows matching the condition**. Useful when you always query a small, well-defined slice of a big table: the index is tiny, fast, and cheap to maintain. All of ours are RAW SQL in the init migration.
| Partial index | Use case | Why partial |
|---------------|----------|-------------|
| `users_email_active_key` UNIQUE `(email) WHERE deleted_at IS NULL` | One account per email. | A user who deleted their account can sign up again with the same email, because deleted rows are ignored. A normal unique index would block that forever. |
| `sessions_user_device_live_key` UNIQUE `(user_id, device_id) WHERE revoked_at IS NULL` | One *live* session per device. | Old revoked sessions are kept for history and must not collide. Also stops two simultaneous logins on one phone from creating two live sessions. |
| `users_banned_idx` `(banned_at DESC) WHERE is_banned` | Admin "banned users" list. | Maybe 20 banned users among 100,000. The index holds only those 20 entries. |
| `sessions_user_live_idx` `(user_id) WHERE revoked_at IS NULL` | "Live sessions of a user." | Revoked sessions pile up forever; the index ignores them so it stays small as history grows. |
| `coach_profiles_listable_idx` `(user_id) WHERE approved AND available` | People screen "Available now" coaches. | Few coaches are approved and online at any moment. |
| `one_time_codes_active_key` UNIQUE `(user_id, purpose) WHERE consumed_at IS NULL` | At most ONE active code per user and purpose. | "Send a new code" first marks the old one consumed. If two requests race, the database refuses the second instead of leaving two valid codes. Used/replaced codes are kept as history without blocking anything. |
| `subscriptions_expiring_idx` `(expires_at) WHERE status IN (TRIAL, ACTIVE, GRACE_PERIOD, CANCELLED_ACTIVE)` | Background job finding subscriptions about to end. | Expired rows (the majority over time) never need that scan. |

Important: for Postgres to use a partial index, the query's WHERE must **include the index condition**. That is why every "live user" query has `deletedAt: null` and every "live session" query has `revokedAt: null`. Because the email unique index is partial, Prisma has no `findUnique({ email })`; we use `findFirst({ email, deletedAt: null })`.

**GIN index** `coach_profiles(specialties)`: for array/JSON/text-search columns ("does the array contain 'Burnout'"). A B-tree can't do that.

**CHECK constraints**: the database refuses bad data even if app code has a bug.
- `users_email_lowercase_chk`: `email = lower(email)`
- `users_ban_consistent_chk`: a banned user must have `banned_at`
- `blocks_not_self_chk`: you cannot block yourself
- `one_time_codes_attempts_chk`: wrong-guess counter can't go negative

**Planned indexes (not created yet, with the use case)**
| Where / when | Index | Why |
|--------------|-------|-----|
| People search (step 1.4) | `pg_trgm` GIN on `lower(users.name)` | `ILIKE '%ana%'` can't use a B-tree because of the leading `%`. Trigram index makes substring search fast. |
| Chat (Phase 7) | UNIQUE `messages(sender_id, client_msg_id)` | Idempotency: a retried send can never create a duplicate message. |
| Chat | `messages(conversation_id, seq)` | Fetch history pages and "everything after seq N" after reconnect. |
| Calls (Phase 3) | `calls(state) WHERE state IN ('RINGING','ACTIVE')` | Find live calls (busy check, ring timeout sweeper) among millions of finished ones. |
| Calls | UNIQUE `call_participants(call_id, user_id)` | A person can't be in a call twice. |
| Calls | UNIQUE `call_participants(call_id) WHERE role_in_call='COACH'` | **Enforces "exactly one coach per call" in the database itself.** |
| Calls | `call_participants(user_id) WHERE state IN ('RINGING','JOINED')` | "Is this user already in a call?" (BUSY check) is a tiny index lookup. |

**Do not over-index.** Every index slows writes and uses disk. Add one only for a query you actually run; check with `EXPLAIN ANALYZE` first.

### 4.4 Transactions
A transaction is "all or nothing". Used where several changes must stay consistent:
- **Ban**: user flag + revoke sessions + audit entry all succeed together or not at all.
- **Login**: revoke the old session on this device + create the new one.
- Audit rows are written *inside* the same transaction as the action they describe, so the log can never disagree with reality.
- Later (group calls): invite uses a row lock (`SELECT ... FOR UPDATE` on the call) so two simultaneous "add person" requests can't both take the last seat.

---

## 5. Authentication

### 5.1 Passwords
- Hashed with **Argon2id** (`password.service.ts`): deliberately slow and memory-hungry (19 MiB, 2 passes: the OWASP minimum), random salt built into the hash string. Even if the database leaks, passwords are expensive to crack.
- Never store, log or return the password or hash. Max length 128 (blocks "send 10 MB as a password to burn CPU").
- **Unknown email on login** still runs a dummy Argon2 check, so response time doesn't reveal which emails exist. Errors are identical for wrong password / unknown email / social-only account / wrong app for role.
- `needsRehash` upgrades old hashes on the next successful login if we strengthen the settings.

### 5.2 Token lifecycle (the part to understand)

Two tokens with different jobs:

| | Access token | Refresh token |
|---|---|---|
| Form | JWT (signed JSON) | Random string `<sessionId>.<secret>` |
| Lives | **15 minutes** | up to 30 days of inactivity |
| Sent | On **every** API call: `Authorization: Bearer ...` | Only to `POST /auth/refresh` |
| Server stores | nothing (but checks session in DB, see below) | only **SHA-256 hash** of the secret |
| If stolen | useful for at most 15 min | detected by rotation (below) |

Why two? A long-lived token sent on every request is dangerous if it leaks. A short one limits damage; the refresh token is used rarely and only over one endpoint, and can be rotated and revoked.

**Timeline of one login**
1. `POST /auth/login` → server verifies password, creates a **session** row (one per device), returns `{accessToken, refreshToken, expiresIn}`.
2. App stores both in the **Keychain/Keystore** (never AsyncStorage/MMKV) and sends the access token with each request.
3. After 15 min the server answers `401 INVALID_TOKEN`. The app calls `POST /auth/refresh` with the refresh token and gets a **new pair**.
4. The app retries the original request. Kill/reopen app: tokens are still in the Keychain, so the user stays logged in (PRD acceptance).
5. `POST /auth/logout` revokes the session. Refresh fails → app returns to login.

**Refresh-token rotation + reuse detection** (`auth.service.ts` → `refresh`)
- Every refresh issues a *new* secret and keeps the *previous* hash.
- If the **current** secret arrives → normal, rotate.
- If the **previous** secret arrives **within 30 s** → assume a lost response or double request (mobile networks drop), just rotate again. (`REFRESH_GRACE_MS`)
- If the previous secret arrives **after 30 s** → someone is replaying a stolen token. The whole session is revoked (`REUSE_DETECTED`) and logged; both the thief and the owner must log in again.
- Unknown secret for a real session id → plain 401 (no revoke, so nobody can lock out a user by guessing).
- Concurrent refreshes are safe: the update is conditional on the hash we read ("optimistic lock"); the loser re-reads and succeeds via the grace rule.
- Why SHA-256 and not Argon2 for the refresh secret? It's 256 random bits, impossible to brute-force, and refresh must be cheap. Passwords are low-entropy, so they need the slow hash.

**Why the guard also reads the database** (`jwt-auth.guard.ts`)
A valid signature only proves the token was issued. To make logout and bans effective *immediately*, the guard (every request) also loads the session + user by primary key and rejects if the session is revoked/expired, the user is banned or deleted. Cost: one cheap indexed query per request. Role also comes from this DB read, not the token, so demoting an admin applies instantly. (Token claim `role` is a hint for the client UI only.)

**Error codes the app switches on**
| Code | HTTP | App should |
|------|------|-----------|
| `MISSING_TOKEN`, `INVALID_TOKEN` | 401 | try `/auth/refresh` once, else go to login |
| `SESSION_REVOKED`, `SESSION_EXPIRED`, `REFRESH_REUSED`, `INVALID_REFRESH_TOKEN` | 401 | clear tokens, go to login |
| `ACCOUNT_BANNED` | 403 | clear tokens, show "account suspended" |
| `WRONG_AUDIENCE` | 403 | bug: wrong token for this API |
| `FORBIDDEN_ROLE` | 403 | show "no permission" |
| `INVALID_CREDENTIALS` | 401 | show "email or password incorrect" |
| `EMAIL_TAKEN` | 409 | show "account exists" |

### 5.3 Endpoints (Phase 1)
**How a route is defined (`apps/api`).** The path comes from `API_ROUTES` in `packages/shared/src/api.ts` (`@Post(API_ROUTES.auth.login)`), the body/query is checked by a zod schema from `packages/shared/src/schemas` named on the decorator (`@Body({ schema: LoginInputSchema }) dto: LoginInput`), and the global `ZodValidationPipe` (`common/pipes`) hands the controller the *parsed* value. Add a route = add its path and schema to `packages/shared` first. Env vars are declared in `config/env.ts` (zod) and checked at boot. OpenAPI page: `/docs` (not in production).

| Method + path | Auth | Notes |
|---------------|------|-------|
| `POST /auth/register` | public | Always creates a `MEMBER`. Extra fields (e.g. `role`) are rejected (400). |
| `POST /auth/login` | public | MEMBER/COACH only. |
| `POST /auth/refresh` | public (needs refresh token) | Works for mobile and admin sessions. |
| `POST /auth/logout` | any token | Revokes current session. 204. |
| `GET /auth/me` | any token | Profile + subscription + `canCall`. |
| `POST /auth/email/send-code` | any mobile token | Emails a new 6-digit code (10 min). 429 `CODE_COOLDOWN` + `retryAfterSeconds` if asked within 60 s. 409 `ALREADY_VERIFIED`. |
| `POST /auth/email/verify` `{code}` | any mobile token | 200 `{emailVerified:true}`. 400 `INVALID_CODE` (+`attemptsLeft`), `CODE_EXPIRED`, `CODE_LOCKED` (5 wrong guesses). |
| `POST /auth/password/forgot` `{email}` | public | Step 1. Emails a 6-digit reset code. **Unknown email -> 404 `ACCOUNT_NOT_FOUND`** (product decision: the app then offers "Create an account"; trade-off: anyone can check whether an email has an account, limited by the 10/min throttle). Inside the 60 s cooldown it answers 200 with the seconds left and sends nothing. Mail failure -> 503 `EMAIL_SEND_FAILED` and the code is retired, so retrying works at once. Mobile users only (staff skipped). |
| `POST /auth/password/verify-code` `{email, code}` | public | Step 2. Right code -> `{resetToken, expiresInSeconds}` (10 min). Wrong/expired/locked -> 400 `INVALID_CODE` (+`attemptsLeft`), `CODE_EXPIRED`, `CODE_LOCKED`. |
| `POST /auth/password/reset` `{resetToken, newPassword}` | public | Step 3. Sets the password, **signs out every device** (`PASSWORD_CHANGED`), marks the email verified, writes an audit row. Bad/expired/used token -> 400 `RESET_TOKEN_INVALID`. |
| `POST /admin/auth/login` | public | SUPPORT/ADMIN only. Issues an `admin`-audience token. |
| `GET /admin/users/:id` | SUPPORT, ADMIN | Read-only user detail. |
| `POST /admin/users/:id/ban`, `/unban` | ADMIN only | See Section 7. |
| `GET /people?kind=coaches\|members&q=&specialty=&available=&cursor=&limit=` | any logged-in mobile user | Hides yourself, banned/deleted, blocked (both directions), unapproved coaches. Returns no email. `q` = part of a name, any case. `specialty` / `available=true` apply to coaches only. Returns `{items, total, nextCursor}` (+ `specialties`: all specialties on offer, coaches tab only, for the filter chips); send `nextCursor` back as `cursor` for the next page (`null` = last page). Bad cursor -> 400. |
| `GET /chat/conversations` | mobile user | My chats that have at least one message, newest first (max 50): `{id, other, lastSeq, unreadCount, lastMessage}`. Hides chats with banned/deleted/blocked people. |
| `POST /chat/conversations` `{userId}` | mobile user | Start or reopen the chat with someone (same conversation both ways). 404 `USER_NOT_FOUND` for self/unknown/banned/staff/unapproved coach/blocked (a block looks like "missing"). |
| `GET /chat/conversations/:id/messages?before=&after=&limit=` | participant | Newest page by default; `before=N` older; `after=N` newer (catch-up). Oldest first. Also `lastSeq`, `otherReadSeq`, `hasMore`. Non-participant -> 404. |
| `POST /chat/conversations/:id/messages` `{clientMsgId, body}` | participant | Saves a message (1-2000 chars, trimmed). **Idempotent**: same `clientMsgId` returns the first message with `duplicate:true`. 403 `CANNOT_MESSAGE` if blocked/banned recipient. |
| `POST /chat/conversations/:id/read` `{upToSeq}` | participant | "I have seen up to N". Only moves forward, capped at the newest message. |
| `GET /health` | public | |

Rate limit: 120 req/min per IP globally, **10/min on login/register/refresh** (HTTP 429). (Per-IP only for now; add per-account lockout later.)

---

### 5.5 Forgot / reset password (3 steps, 3 screens)
- Built on the shared `OneTimeCodeService` (`auth/one-time-code.service.ts`): `cooldownLeft`, `issue`, `retire`, `verifyAndRun`. Email verification and password reset use it with different `purpose` values, so a code for one never works for the other (tested).
- Flow: Sign in -> "Forgot password?" (under the password field) -> `ForgotPasswordScreen` (email; unknown email shows "We could not find an account" + "Create an account", which opens Register with the email filled in) -> `ResetCodeScreen` (6 boxes; a Verify button appears only once all 6 digits are typed) -> `NewPasswordScreen` (checklist) -> Sign in with a green "Password updated" notice.
- **Why a reset token between step 2 and 3:** step 2 consumes the code and returns a short JWT (`aud: password-reset`, signed with a secret derived from the access secret, 10 min). It carries a fingerprint (`pwv`) of the current password hash, so after the password changes the token is dead: single use without a table. Step 3 needs only the token, never the code again.
- If the token expires while the user types the new password, the app returns to the Forgot screen with a toast.
- Staff (Support/Admin) do not reset through the app.
- No design existed for these screens; they follow the Verify email design. Ask the designer to review.

### 5.6 Password rule
8-128 characters with one lowercase letter, one uppercase letter and one number. One regex in `packages/shared/src/constants.ts` (`PASSWORD_PATTERN`; the zod schema used by register and reset is built from it) and the same four rules as a checklist in `apps/mobile/src/utils/helpers/passwordRules.ts`, which feeds the live checklist (`PasswordChecklist`). Login does NOT apply the rule (older accounts must still sign in).

### 5.7 Sending real email
`MAIL_DRIVER` in `apps/api/.env` picks the sender (`mail/mailer.service.ts`):
| Driver | When | Needs |
|--------|------|-------|
| `console` (default) | Local dev, tests: prints the email, so you read the code in the backend terminal | nothing |
| `smtp` | Gmail App Password in dev, or any SMTP provider (Brevo, Mailtrap, ...) | `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` |
| `resend` | Production-friendly HTTP API | `RESEND_API_KEY`, `MAIL_FROM` on a domain verified at Resend |
- Missing settings for the chosen driver stop the backend at start-up with a clear message; blank lines (`SMTP_PORT=`) count as unset.
- Test the setup without the app: `cd apps/api && pnpm mail:test you@example.com` (restart the backend after editing `.env`).
- Templates live in `mail/templates.ts` (`codeEmail`, plain text + escaped HTML). The e2e config forces `MAIL_DRIVER=console`, so tests never send mail.

### 5.4 Email verification (6-digit code)
- **Sign-up** creates the user and emails a code. The app then shows "Check your email" until the code is entered; the account exists either way, so the back arrow just signs out and the user can verify later.
- The code is random (`crypto.randomInt`), valid 10 minutes, and stored only as an **HMAC** (hash with our secret). A plain hash of a 6-digit number could be reversed instantly if the database leaked; the HMAC cannot without the secret.
- **Limits:** 5 wrong guesses lock the code (counted atomically, so parallel guesses can't dodge it); one email per minute per user; routes are rate-limited.
- A new code retires the old one, so only one is ever valid.
- **Mailer:** see section 5.7 (console in dev by default; SMTP or Resend when configured). If sending fails, the code is retired and the API answers 503 `EMAIL_SEND_FAILED`; sign-up itself still succeeds and the user can press resend.
- The mobile app gates on `user.emailVerified`. The API itself does not yet refuse unverified users (decide later if calls should require a verified email).

### 5.8 People search and paging
- **Search** = `name ILIKE '%text%'`. A normal index cannot serve "text in the middle", so migration `20261026150000_people_name_search` adds a **trigram GIN index** (`pg_trgm`, partial: only non-deleted users). The user's own `%` and `_` are escaped so they are plain letters (a test caught this).
- **Cursor paging** (keyset): the cursor is the last row's `(name, id)`; the next page asks for rows after it. Unlike `OFFSET`, page 50 is as fast as page 1 and nobody is repeated or skipped if the list changes between requests. We fetch `limit + 1` rows to know whether another page exists.
- `total` counts everything matching the filters, not just the page.

### 5.9 Chat (Phase 7, first slice: REST + polling)
- **Tables:** `conversations` (one row per PAIR: `user_a_id < user_b_id` CHECK, unique pair, so "A to B" and "B to A" are the same row and self-chat is impossible) and `messages` (`seq` = 1,2,3 inside the chat; unique `(conversation_id, seq)` and unique `(sender_id, client_msg_id)`).
- **Message numbers without races:** one `UPDATE conversations SET last_seq = last_seq + 1 ... RETURNING` inside the transaction takes the next number; the row lock makes parallel sends queue up (tested with 9 at once: numbers 1..9, no gaps).
- **Idempotent send:** the app makes a `clientMsgId` for every message. A retry after a bad connection returns the same saved message, so nothing is duplicated (also when two identical requests race: the unique index decides and the loser fetches the winner).
- **Unread without counting:** sending a message sets the sender's read marker to it, so `unreadCount = last_seq - my_read_seq`. "Seen" = the other side's `read_seq >= message.seq`.
- **Privacy:** only the two people can read a chat (others get 404, not 403). Blocks hide the chat and stop sending; banned or deleted people are hidden.
- **Mobile:** `Messages` (list, unread badge, refreshes every 5 s while visible), `Chat` (inverted list, bubbles, "Sending… / Not sent, tap to retry / Sent / Seen", loads older on scroll up, asks for newer messages every 3 s), `useChat` hook, `chatApi`. The chat opens as a layer over the tabs (from a Messages row or the chat button in People). Message numbers (`after=N`) are the catch-up cursor.
- **Not built yet (Phase 7 remainder):** Socket.io real-time (polling is the stand-in), offline outbox that survives app restarts, typing, images, push notifications, day separators and the offline banner. Moving to sockets keeps the same REST endpoints for catch-up.

## 6. RBAC (role-based access control)

**Secure by default.** Three global guards run on every route, in order (`app.module.ts`):
1. `ThrottlerGuard`: rate limit.
2. `JwtAuthGuard`: must be logged in (unless `@Public()`), token audience must match the route (`@Audience('mobile'|'admin'|'any')`, default `mobile`), session and user must be healthy.
3. `RolesGuard`: if the route has `@Roles(...)`, the user's DB role must be in the list, else `403 FORBIDDEN_ROLE`.

How to protect a new route: nothing for "any logged-in member/coach"; `@Roles('ADMIN')` for admin-only writes; `@Roles('SUPPORT','ADMIN')` for staff reads; `@Audience('admin')` on admin controllers; `@Public()` only for login/health/webhooks.

| Capability | MEMBER | COACH | SUPPORT | ADMIN |
|-----------|:-----:|:-----:|:-------:|:-----:|
| Use mobile app APIs | ✔ | ✔ | ✘ | ✘ |
| Use admin APIs | ✘ | ✘ | read-only | ✔ |
| Ban / unban | ✘ | ✘ | ✘ | ✔ |

Defence in depth:
- Role separation by **login endpoint** (staff can't get mobile sessions and vice versa) *and* by **token audience** (checked per route).
- Public register can only create `MEMBER` (`forbidNonWhitelisted` rejects a `role` field).
- Admins can't ban themselves or other staff.
- The UI hiding a button is never the protection; tests assert Support gets 403 from the server.
- Admin panel in Phase 9 will add httpOnly cookies and 2FA on top (not built yet: today admin tokens are returned in the body).

## 7. Ban flow (immediate)

`POST /admin/users/:id/ban {reason, note?}` → `BanService.ban` (`moderation/ban.service.ts`):
1. **One transaction:** set `is_banned/banned_at/ban_reason/banned_by_id` → revoke every live session (`BANNED`) → write audit entry `user.ban`.
2. Later phases add the realtime part: after the commit, disconnect the user's sockets, end active calls and remove them from LiveKit rooms (target: within 5 s). Nothing listens yet, so there is no event today.

Why it is immediate: the guard hits the database on every request, and sessions are revoked in the same transaction, so even a not-yet-expired access token is rejected on the next call (`401 SESSION_REVOKED`; with a surviving session it would be `403 ACCOUNT_BANNED`). Login and refresh also refuse. Unban clears the flag but leaves old sessions dead: the user signs in again.

Idempotent: banning twice does nothing extra (and writes one audit row). Reason must be one of a fixed list (matches the admin UI).

---

## 8. Architecture decisions log

| Decision | Why | Date |
|----------|-----|------|
| Prisma 7 with `@prisma/adapter-pg`, client generated into `src/generated/prisma` (git-ignored) | Typed queries; Prisma 7 needs a driver adapter. | 2026-10 |
| Opaque random refresh token (not a JWT) | Can be revoked/rotated, stored hashed; no `JWT_REFRESH_SECRET` needed (removed from `.env.example`). | 2026-10 |
| Sessions table checked on every request | Instant logout/ban; cost = one PK lookup. Plan's `token_version` column dropped as redundant. | 2026-10 |
| Single JWT secret + `iss`/`aud` claims, not two secrets | Simpler; audience is enforced per route. Revisit when admin panel gets cookies. | 2026-10 |
| `MEMBER` replaces `CLIENT` | Matches the new UI ("Members"). | 2026-10 |
| Docker Postgres bound to `127.0.0.1` | Publishing 5432 on all interfaces exposes the DB on public Wi-Fi with a password that is in git. | 2026-10 |
| Seed refuses `NODE_ENV=production` | Dev passwords must never reach a real database. | 2026-10 |
| Monorepo like the Zenkoders boilerplate (pnpm + Turborepo, `apps/*`, `packages/shared`) | One contract (zod schemas + route list) for API, mobile and web; same layout on every Zenkoders project. | 2026-10 |
| API validates with zod schemas from `@coach-connect/shared` (`@Body({ schema })`), not class-validator DTOs | The mobile forms and the API cannot drift; unknown fields are rejected with `z.strictObject`. Errors are `{ message, errors: { field: [..] } }`. | 2026-10 |
| Mobile stays bare React Native; only the boilerplate's structure was adopted | Our native setup (Keychain, signed simulator builds) works; Expo CNG would be a migration with no product benefit now. | 2026-10 |

## 8b. Mobile app structure (`apps/mobile/`)

Follows the Zenkoders boilerplate (`mono-repo` branch), but stays **bare React Native 0.88** (our own `ios/` and `android/`, Keychain, SVG). We copied the *structure and conventions*, not Expo.

```
App.tsx                      Providers: React Query -> SafeArea -> NavigationContainer (after the splash) + toast host
index.js                     AppRegistry entry (bare RN)
src/
  assets/                    (images/fonts when we add them)
  components/
    index.ts                 Barrel: screens import UI from "@/src/components"
    common/<CustomName>/     index.tsx + interface.ts (props) [+ hook/ when the component has logic]
    wrappers/CustomWrapper   Screen root: background, safe-area top, optional scroll + keyboard avoiding
  constants/                 theme/ (COLORS, SPACING, RADIUS, TEXT, FONT), endpoints.ts (shared API_ROUTES), general.ts (API URL, shared constants)
  navigations/               RootStack.tsx (native stack, screens chosen by sign-in status), navigationRef.ts
  screens/<module>/<screen>/ <Screen>.tsx (thin UI) + hook/use<Screen>.tsx (all the logic)
    auth/    signIn, register, forgotPassword, resetCode, newPassword, verifyEmail
    system/  splash, offline
    home/    main (tab bar), people, messages, chat, calls, profile
  service/
    api/*.api.ts             Plain request functions per domain (authApi, peopleApi, chatApi), typed with @coach-connect/shared
    setup/                   apiClient.ts (apiRequest + ApiError), withAuth.ts (token refresh), handleApiError.ts (error -> toast)
  store/                     auth.store.ts, toast.store.ts (Zustand), secureStorage.ts (Keychain)
  utils/                     helpers/ (passwordRules, time, validation), hooks/ (useCountdown, useDebounced, useInterval), types/ (navigationType)
__tests__/                   mirrors src/ (screens, components, service, store, utils) + App.test.tsx (real navigation)
test-utils/                  render (with React Query), byLabel/press/typeInto helpers, navigation mock
```
Import alias: `@/` = the `apps/mobile` folder (`@/src/components`). It is set in `tsconfig.json`, `babel.config.js` (module-resolver) and `jest.config.js`.

**Deliberate differences from the boilerplate**
- Bare RN, not Expo (no `app.config.ts`, `ios/` and `android/` are committed). Keychain instead of `expo-secure-store`; no MMKV yet.
- `fetch` + our own `ApiError(status, code, message, data)` instead of axios + `handleRequest`. Hooks *throw* (React Query expects it) and the toast shows `error.message`; `code` drives behaviour.
- No `react-native-responsive-screen` / `RFValue`: sizes are plain points taken from the design.
- Chat messages use our own hook (`useChat`: optimistic send, retry with the same `clientMsgId`, 3 s polling) instead of React Query, because pending messages and "seen" do not fit a plain query. People and Messages use React Query (`useInfiniteQuery` / `useQuery` with `refetchInterval`).
- The bottom tab bar is hand-made (`home/main`), inside ONE native-stack screen. Native stack only (never `@react-navigation/stack`).

**Navigation = sign-in status.** `RootStack` shows a different group of screens per `auth.store` `status`: `signedOut` -> Sign in / Create account / Forgot password / Enter the code / New password; signed in but email not verified -> Verify email; `offline` -> Offline; otherwise Main + Chat. When the status changes the whole group swaps, so nobody can reach a signed-in screen while signed out and nobody calls `navigate()` after signing in. Forgot password passes data through route params (`ResetCode {email, resendSeconds}`, `NewPassword {resetToken}`); finishing it does `CommonActions.reset` to Sign in with `{passwordUpdated: true}`.

**Screen pattern.** `const SignIn: React.FC<Props> = ({ route }) => { const s = useSignIn(route.params); ... }`. The hook holds state, validation, API calls and navigation; the screen only draws. Tests mock the API module and `useNavigation` (see `test-utils/navigation.ts`) and assert on what the hook did.

**Errors as toasts:** server errors go through `service/setup/handleApiError.ts` (`showApiError`) and `CustomToastHost`; screens keep only field-level hints inline. Server validation answers look like `{ message: 'Validation failed', errors: { field: [messages] } }`; `apiClient` shows the first field message. Web still uses an inline banner.

Screens: `Splash` (green, determinate progress bar), `SignIn`, `Register`, `CustomCodeEntry` (shared by `VerifyEmail` and `ResetCode`: 6 boxes over ONE hidden input so paste/keypad/iOS autofill work; Verify button only after 6 digits; resend countdown), `ForgotPassword`, `NewPassword`, `Offline`, and the tabs **People** (design 07: debounced search, specialty chips, "Available now", cursor paging, specialty tag pills on coach cards), **Messages** (design 09), **Chat** (design 10), Calls (placeholder), Profile (temporary: shows `/auth/me` and has a dev button to spoil the token and test refresh). Native launch screens (iOS `LaunchScreen.storyboard`, Android `windowBackground`) are green too, so there is no white flash before the JS splash.

**Tests:** `pnpm test` in `apps/mobile` (or `pnpm turbo test`). Gotchas: `jest.setup.js` mocks `react-native-svg`, `react-native-safe-area-context`, and `@react-navigation/native` (hooks only: `App.test.tsx` opts out with `jest.unmock` to test the real stack); React Query's scheduler is made synchronous; `transformIgnorePatterns` lets Jest compile `@react-navigation`; in a real stack the earlier screens stay mounted, so `byLabel` returns the LAST (top) match; a timer that re-arms itself after each render needs one `act` per second; trees are unmounted after every test (`jest.setup.after.js`). Fonts (Bricolage Grotesque, Hanken Grotesk) are not bundled yet; system font is used.

**Run it on the iOS simulator:** (1) API running on port 3000, (2) `cd apps/mobile && pnpm dev` (Metro), (3) `pnpm ios` (or build in Xcode and open the app). Log in as `sara@coachconnect.dev` / `Password123!`. Placeholder to change before release: the iOS bundle id is still the template's `org.reactjs.native.example.CoachConnect` and Android's is `com.coachconnect`.

**Native paths in a monorepo.** Dependencies are hoisted to the repo root, so `ios/CoachConnect.xcodeproj` points `REACT_NATIVE_PATH` at `${PODS_ROOT}/../../../../node_modules/react-native` and `android/settings.gradle` includes `../../../node_modules/@react-native/gradle-plugin`. `metro.config.js` watches the root `node_modules` and `packages/shared`.

### 8c. Admin web panel (`apps/web/`)
- **Stack:** Next.js (App Router) + TypeScript, plain CSS Modules with design tokens in `globals.css` (chosen over Tailwind: fewer new concepts for a first Next.js project; can be added later). Fonts: Bricolage Grotesque (headings), Hanken Grotesk (body).
- **Production = static export** (`output: 'export'`): plain files in `out/` that the NestJS backend will serve from the same address as the API, so the secure login cookie works and there is one deployable service. Consequence: no Next server features (rewrites, cookies(), server actions, route handlers using the request). All data comes from the backend API via `fetch` in the browser.
- **Development:** `pnpm dev` on port 3001; `next.config.ts` forwards `/api/*` to the backend (port 3000), so the browser sees one address. (Rewrites only exist in dev; static exports do not allow them.) TODO before deploy: make the backend answer under the path the built panel calls (e.g. serve the panel under `/panel` and keep API paths).
- `src/lib/api.ts` (one place for requests, `ApiError` with backend codes), `src/lib/session.ts` (sign in/out, `useSession()`), `src/components/AdminShell.tsx` (sidebar + frame, redirects to Sign in when signed out), pages: `/login`, `/dashboard`.
- **Temporary:** tokens are kept in page memory only (never localStorage), so a refresh signs you out. Next backend step: httpOnly cookie login + CSRF protection, then 2FA for ADMIN. Pages only use `session.ts`, so they won't change.
- Sidebar items other than Dashboard are shown greyed ("Coming soon") until their pages exist.

### 8d. App icon
Source of truth: `apps/mobile/scripts/generate-icons.mjs` (draws the "C inside C" mark; run `pnpm icons` in `apps/mobile/`). It writes `apps/mobile/assets/app-icon.svg`, the iOS 1024 px icon (`AppIcon.appiconset`, no transparency; iOS rounds the corners) and Android legacy, round and adaptive icons (`mipmap-*`, `mipmap-anydpi-v26`, colors in `values/colors.xml`; mark kept inside the adaptive safe zone, also used as the Android 13 themed icon). Change the design in that script and re-run. Checked: iOS build shows it on the home screen; Android `mergeDebugResources` succeeds (not run on an emulator).

**Docs policy:** `Requirement & Design/` (client PRD, UI export, plans) is git-ignored and stays on your machine. Only `README.md` and `knowledge.md` are shared in the repo.

## 9. Security checklist (keep true)
- [ ] No secret in git: `.env*` ignored except `.env.example`; the mobile app ships no secrets.
- [ ] Every new route is protected by default; `@Public()` only where intended.
- [ ] Every admin write goes through a service that writes an audit row in the same transaction.
- [ ] Role/ban/subscription decisions read the database, never the token claims.
- [ ] Input is validated by a zod schema from `packages/shared` (`@Body({ schema })`); unknown fields rejected (`z.strictObject`).
- [ ] Rate limit on anything that checks a secret.
- [ ] Dev credentials (`Password123!`, `coach_dev_password`) exist only in dev; staging/prod use real secrets.

## 10. Testing approach
- **Unit tests** (`*.spec.ts`): pure logic (e.g. `hasActiveAccess`). Fast, no DB.
- **Integration tests** (`test/*.e2e-spec.ts`): boot the real Nest app against the `coachconnect_test` database, tables truncated before each test. They cover: register/login, hashing, rotation, grace window, theft detection, logout, tampered tokens, audience separation, RBAC, ban side effects, idempotent ban, unban.
- We *mutation-checked* the key tests (disabled the ban check / session revoke on purpose; the tests failed as they should).
- Not tested yet: rate limiting (disabled when `NODE_ENV=test`), concurrent registration race.

## 11. Open product decisions (need client answers)
See `Detailed Plan` section A3 (D1-D9): group size 6 vs the PRD's 4, who can add people, subscription for added members, summaries for member-to-member calls, when a coach call ends, chat gating.

## 12. What's next
Phase 1 remaining: Google/Apple sign-in; change password (B4); admin cookie login + CSRF (B5) and 2FA (B6); real email provider configured by the owner (section 5.7). Then Phase 2 (mobile shell) and Phase 3 (calls).

## 13. Changelog
- **2026-10-23, Phase 0:** monorepo, RN deps swapped for LiveKit stack, Nest 12 scaffold, local Postgres 16.
- **2026-10-23, Phase 1 (part 1):** Prisma schema + hand-written partial indexes and CHECKs; Argon2id passwords; access JWT + rotating hashed refresh tokens with theft detection; global JWT/Roles guards; admin login; ban/unban with immediate effect and audit log; seed data; 23 integration tests.
- **2026-10-26, Phase 1 (part 2):** fixed a timezone bug (app-written times were stored shifted on non-UTC machines); added `GET /people` (step 1.4a) with 6 tests.
- **2026-10-26, Auth flow (mobile):** M1 API client, M2 Keychain token storage, M7a Sign in screen UI with theme/components; 18 mobile tests. `Requirement & Design/` is now git-ignored.
- **2026-10-26, Auth flow (mobile):** M3 typed auth API calls (`authApi`).
- **2026-10-26, Auth flow (mobile):** M4 auth store with session restore.
- **2026-10-26, Auth flow (mobile):** M5 automatic refresh (`withAuth`, single shared refresh); M6/M7b root gate and Sign in wired to the backend; temporary Home screen; 43 mobile tests.
- **2026-10-26, first run on a simulator:** real login, wrong-password error, silent token refresh and restart persistence verified on iPhone 17 Pro. Fixed: stale form errors now clear on edit; app no longer hangs on the splash if Keychain fails.
- **2026-10-26, Auth flow (batch 2):** new splash (green, SVG "C inside C" logo, determinate bar) + green native launch screens; email verification backend (mailer, `one_time_codes`, HMAC codes, attempt limit, cooldown); Create account and Verify email screens; Root switch; backend 41 tests, mobile 63 tests.
- **2026-10-26, verified on the simulator:** splash, Sign in, Create account (live password tick), Verify email (wrong code -> "4 tries left", right code -> Home) against the real backend; fixed refocus bug; 64 mobile + 41 backend tests.
- **2026-10-26, admin web started:** Next.js 16 scaffold (static export in production, dev proxy), sign-in page (design A1) and dashboard shell (A2) connected to the real backend; session helper with logout; 8 admin tests. App icon added for iOS and Android. Port-in-use fix documented.
- **2026-10-27, forgot / reset password:** shared `OneTimeCodeService` (refactor, tests stayed green), `POST /auth/password/forgot` + `/reset` (no account leak, signs out all devices), mobile Forgot + Reset screens with shared CodeInput/ResendRow; verified end to end on the simulator. Backend 55 integration + 7 unit tests, mobile 79 tests.
- **2026-10-26, auth polish + real email:** errors shown as toasts in the app; password rule (lowercase + uppercase + number) with live checklist; "Open mail app" removed and Verify button appears at 6 digits; "Forgot password?" moved under the password field; reset is now 3 steps (email -> code -> new password) with a single-use reset token; unknown email says so and offers "Create an account"; mailer drivers `console`/`smtp`/`resend` with start-up validation and `pnpm mail:test`. Verified on the simulator end to end. Backend 68 integration + 20 unit tests, mobile 120 tests.

- **2026-10-26, People search (step 1.4b):** `q`, `specialty`, `available`, cursor paging, trigram index; separate verification/reset email templates; mail on port 465 note. Backend 73 integration + 21 unit tests.
- **2026-10-26, People screen (mobile):** tabs shell, Coaches/Members with search, specialty + "Available now" chips, paging, specialty tags on coach cards; backend returns the chip list. Verified on the simulator. Mobile 130 tests, backend 74 integration tests.
- **2026-10-26, chat (first slice):** conversations/messages tables, REST API (open, list, page, idempotent send, read receipts), Messages list and Chat room screens with polling. Verified on the simulator with a coach account answering via the API (message arrived, "Seen" shown). Backend 92 integration tests, mobile 148.
- **2026-10-26, monorepo refactor (boilerplate layout):** `mobile/`, `backend/`, `admin/` moved to `apps/mobile`, `apps/api`, `apps/web`; pnpm + Turborepo; new `packages/shared` (zod schemas, `API_ROUTES`, types, constants) and `packages/tsconfig`. API now validates with the shared zod schemas through a global `ZodValidationPipe` (class-validator DTOs removed), env validated with zod, OpenAPI at `/docs`. Mobile restructured to the boilerplate folders (`components/common/Custom*`, `screens/<module>/<screen>` + `hook/`, `service`, `store`, `constants`, `utils`), native-stack navigation driven by sign-in status, React Query for People/Messages/Profile. Backend 94 integration + 21 unit tests, mobile 155, web 8, shared 6.
- **2026-10-27, cleanup pass:** removed everything nothing imported: 17 unused native libraries from the app (list and how to restore them in section 1.2), the unused `push_tokens` table and `subscriptions.source/last_event_id` (migration `drop_unused_push_tokens_and_subscription_source`), the event emitter and the log-only ban listener, unused props/variants/theme tokens/exports, template READMEs, the mismatched root prettier config. Podfile is the standard RN one again. All suites green; iOS app rebuilt.
