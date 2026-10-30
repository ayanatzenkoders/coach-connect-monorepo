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
| `@op-engineering/op-sqlite` | Offline message outbox (Phase 7) | 18.2.5 |
| `react-native-purchases` | Subscriptions (Phase 6) | 10.15.1 |
| `@sentry/react-native` | Crash reporting (Phase 10) | 8.32.0 |
| `@react-native-google-signin/google-signin`, `@invertase/react-native-apple-authentication` | Google / Apple sign-in | 16.1.5, 2.5.1 |
| `react-native-image-picker` | Chat images / avatars. It needs `-framework UniformTypeIdentifiers -framework MobileCoreServices` in the Podfile `post_install` when frameworks are dynamic | 8.3.0 |
| `@react-navigation/bottom-tabs`, `@react-native/new-app-screen`, `@babel/preset-env` | Not used (the tab bar is hand-made; template leftovers) | |
| API: `@nestjs/event-emitter` + the `user.banned` / `chat.message.created` events | Replaced by `RealtimeService` (direct calls, section 5.10). No listener-based events needed | |
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
Tables: `users`, `sessions`, `coach_profiles`, `subscriptions`, `verification_codes`, `chats`, `chat_members`, `messages`, `audit_logs`.

### 4.1 Conventions
- **Primary keys: UUID v7** (`@default(uuid(7))`). Time-ordered, so new rows append to the end of the index (faster inserts, less bloat than random v4) and ids cannot be guessed like `1,2,3`.
- **Timestamps are `timestamptz`** (always carry timezone). Never plain `timestamp`.
- **Emails are stored lowercase** (CHECK constraint) and input is lowercased before use.
- **Soft delete** on users via `deleted_at`; "live" queries always include `deleted_at IS NULL`.
- **Raw SQL lives in the migration file** for anything Prisma can't express (marked `RAW`). Prisma does not drop them (verified: `migrate dev` reports "in sync").
- Never edit an applied migration. Add a new one: `pnpm prisma:migrate --name what_changed` (in `apps/api`). Use `--create-only` to hand-edit the SQL first.

- **Naming standard** (applied by migration `standardize_column_and_table_names`): `snake_case` everywhere; **table names plural** (`audit_logs`, not `audit_log`); **booleans start with `is_`** (`is_approved`, `is_available`; a ban is not a boolean, it is the timestamp `banned_at`); **timestamps end in `_at`** (`banned_at`, `consumed_at`); **foreign keys are `<thing>_id`**; **no abbreviations** in column names (`sequence_number`, `client_message_id`, `failed_attempts`, `previous_refresh_token_hash`); **enum types are snake_case** (`user_role`, `session_audience`), enum values `UPPER_SNAKE`. Prisma model/field names stay camelCase and API field names are a separate contract, so a field can differ from its column (`lastReadSequenceNumber` in code, `last_read_sequence_number` in the database, mapped with `@map`; for chat the API and code now use the same full names as the columns); the data dictionary below always shows the column name.

### 4.1b Data dictionary: every table and column
Types are Postgres types. "Written by" = which code sets it. Column names are what Prisma Studio shows.

**`users`** (one row per account)
| Column | Type | Meaning and use |
|---|---|---|
| `id` | uuid (v7) | Primary key. Goes into the access token (`sub`) and every foreign key. |
| `email` | text | Login name. Lowercase (CHECK) and unique among non-deleted users (partial unique index `users_email_active_key`). Never shown to other users. |
| `password_hash` | text, null | Argon2id hash. Null = social-login-only account (later). |
| `name` | text | Display name shown in People, chats and the admin panel. Searched with the trigram index. |
| `role` (`user_role`) | enum | `MEMBER`, `COACH`, `SUPPORT`, `ADMIN`. Read from the database on every request. |
| `banned_at` | timestamptz, null | The ONLY ban column: null = not banned, set = banned since then. The guard checks it on every request. Who banned and why is not stored here; it is in `audit_logs` (action `user.ban`, `actor_id` + `metadata.reason`). Written by `BanService.ban`; cleared on unban. |
| `phone` | text, null | Coach sign-up only (members are not asked). CHECK: digits, spaces, dashes, brackets, optional leading `+`, 7 to 20 characters. Only ADMINs see it (the admin list hides it from SUPPORT; People never returns it). |
| `date_of_birth` | date, null | Calendar day, no time zone. Required at sign-up for members and coaches, any age; null for accounts made before it existed. CHECK: between 1900-01-01 and today. Shown to staff in the admin panel only. |
| `email_verified_at` | timestamptz, null | Set when the 6-digit email code is accepted (or a password reset proves the address). Null = the app shows "Check your email". |
| `deleted_at` | timestamptz, null | Soft delete (account deletion). Live queries use `deleted_at IS NULL`. |
| `created_at` / `updated_at` | timestamptz | Row bookkeeping. `updated_at` is maintained by Prisma. |

**`sessions`** (one row per signed-in device; the refresh-token system, section 5.2)
| Column | Meaning and use |
|---|---|
| `id` | Session id. Inside every access token (`sid`) and the first half of the refresh token. Revoking the row kills the tokens at once. |
| `user_id` | Owner. |
| `audience` (`session_audience`) | `MOBILE` or `ADMIN`: which client this login belongs to; a token for one cannot open the other's routes (the JWT `aud`). |
| `device_id` / `device_name` | Random id the app makes once per install / a label such as "iPhone". One live session per device (partial unique index). |
| `refresh_token_hash` | sha256 of the CURRENT refresh secret. The secret itself is never stored. |
| `previous_refresh_token_hash` | sha256 of the PREVIOUS secret: detects a stolen, reused token and allows a short retry grace. |
| `rotated_at` | When the refresh secret last changed (drives the 30 s grace window). |
| `last_seen_at` | Last refresh/use; for a future "active devices" screen. |
| `expires_at` | Inactivity limit; pushed forward on each refresh. |
| `revoked_at` / `revoked_reason` (`session_revoke_reason`) | Set when the session ends (logout, replaced, reuse detected, banned, password changed). Null = live. |

**`coach_profiles`** (extra data for users with role COACH; same id as the user)
| Column | Meaning and use |
|---|---|
| `user_id` | Primary key AND foreign key to `users` (one profile per coach). |
| `bio` | Short text shown on the coach card/profile. |
| `specialties` | text[]; the tags on the coach card and the filter chips. GIN-indexed for "coach has specialty X". |
| `is_approved` | An admin approved this coach. Unapproved coaches are invisible in People and cannot be chatted with. |
| `is_available` | The coach switched "available now" on (Profile tab, coaches only; default off). Only available coaches get an enabled Call button. |

**`subscriptions`** (one row per paying user; no row = never subscribed)
| Column | Meaning and use |
|---|---|
| `user_id` | Unique: one subscription per user. |
| `status` (`subscription_status`) | `TRIAL`, `ACTIVE`, `GRACE_PERIOD`, `CANCELLED_ACTIVE`, `EXPIRED`. With `expires_at` it decides `canCall` (`hasActiveAccess`). |
| `plan` | `monthly` or `yearly`. |
| `expires_at` | End of the current paid/trial period. |

**`verification_codes`** (6-digit emailed codes; formerly `one_time_codes`)
| Column | Meaning and use |
|---|---|
| `user_id`, `purpose` (`verification_code_purpose`) | Whose code and what for (`EMAIL_VERIFICATION` or `PASSWORD_RESET`). |
| `code_hash` | HMAC of the code (the code itself is never stored). |
| `expires_at` | 10 minutes after creation. |
| `failed_attempts` | Wrong guesses so far; at 5 the code is locked. |
| `consumed_at` | Set when the code was used or replaced by a newer one; null = the one active code (partial unique index: one active code per user and purpose). |

**`audit_logs`** (append-only: who did what to whom)
`actor_id` (the admin or user who acted; null for system), `action` (`user.ban`, `password.reset`, ...), `target_type` / `target_id` (what it happened to, e.g. `user` + its id), `metadata` (jsonb details: reason, note), `created_at`.

**`chats`** (a chat room; one row per DIRECT pair now, groups later)
| Column | Meaning and use |
|---|---|
| `type` (`chat_type`) | `DIRECT` (two members) or `GROUP` (3 to 6 people, at most ONE coach). |
| `direct_key` | DIRECT only: `<smaller user id>:<larger user id>`, unique, so A-opens-B and B-opens-A are the same chat and a pair never has two. Null for groups (CHECK: DIRECT <=> has a key). |
| `title` | GROUP only; required for a group (CHECK). |
| `description` | GROUP only, optional, up to 300 characters. |
| `created_by_id` | Who created the group (null for direct chats, or if that account was deleted). |
| `last_message_sequence_number` | Number of the newest message; the next message takes this + 1. |
| `last_message_at` | Time of the newest message (sorts the Messages list). Null = an empty DIRECT chat, hidden from the list. A group sets it when it is created, so it shows at once. |
| `created_at` / `updated_at` | Row bookkeeping. |

**`chat_members`** (junction: which users are in which chat, plus how far each has read)
| Column | Meaning and use |
|---|---|
| `chat_id`, `user_id` | Together the primary key. A DIRECT chat has exactly two rows. Index on `user_id` = "my chats". |
| `last_read_sequence_number` | The highest message number this user has read. A message is "seen" by them when its `sequence_number` is at or below it. Unread = `chats.last_message_sequence_number` minus this. Reading 1000 messages is ONE update of this one row; no message row is touched. The other member's number is the "Seen" tick. |
| `joined_at` | When the user joined (a later group join would start with the chat's current number so old messages are not unread). |

**`messages`**
| Column | Meaning and use |
|---|---|
| `chat_id`, `sender_id` | Which chat and who wrote it (the recipient is the other member, so it is not stored). |
| `sequence_number` | 1, 2, 3 ... inside the chat: the order everyone sees and the "give me everything after N" cursor. Unique per chat. |
| `client_message_id` | Made by the sending app per message. Unique per sender: a retry after a bad connection returns the first message instead of saving a duplicate. |
| `body` | The text (1 to 2000 characters, CHECK). |
| `created_at` | When it was saved. |

### 4.2 Every state, and what it means

**`Role`** (who the account is; decides which APIs/screens)
| Value | Meaning |
|-------|---------|
| `MEMBER` | Paying app user. Calls coaches and other members, chats, can be added to coach calls. Needs a subscription to call. |
| `COACH` | Receives calls, never needs a subscription. Applies from the app (`/auth/register-coach`) and is unusable until an admin approves. |
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

**`VerificationCodePurpose`**: `EMAIL_VERIFICATION` (6-digit code after sign-up) or `PASSWORD_RESET` (used in the next step).

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
| `audit_logs(actor_id, created_at)` | "What did this admin do, newest first." |
| `audit_logs(target_type, target_id, created_at)` | "History of this user." |
| `audit_logs(created_at)` | Global recent-activity feed. |

**Unique index**: the database guarantees no duplicates (even if two requests race). `subscriptions(user_id)` (one row per user).

**Partial index** (`... WHERE condition`): indexes **only the rows matching the condition**. Useful when you always query a small, well-defined slice of a big table: the index is tiny, fast, and cheap to maintain. All of ours are RAW SQL in the init migration.
| Partial index | Use case | Why partial |
|---------------|----------|-------------|
| `users_email_active_key` UNIQUE `(email) WHERE deleted_at IS NULL` | One account per email. | A user who deleted their account can sign up again with the same email, because deleted rows are ignored. A normal unique index would block that forever. |
| `sessions_user_device_live_key` UNIQUE `(user_id, device_id) WHERE revoked_at IS NULL` | One *live* session per device. | Old revoked sessions are kept for history and must not collide. Also stops two simultaneous logins on one phone from creating two live sessions. |
| `users_banned_idx` `(banned_at DESC) WHERE banned_at IS NOT NULL` | Admin "banned users" list. | Maybe 20 banned users among 100,000. The index holds only those 20 entries. |
| `sessions_user_live_idx` `(user_id) WHERE revoked_at IS NULL` | "Live sessions of a user." | Revoked sessions pile up forever; the index ignores them so it stays small as history grows. |
| `coach_profiles_listable_idx` `(user_id) WHERE is_approved AND is_available` | People screen "Available now" coaches. | Few coaches are approved and online at any moment. |
| `verification_codes_active_key` UNIQUE `(user_id, purpose) WHERE consumed_at IS NULL` | At most ONE active code per user and purpose. | "Send a new code" first marks the old one consumed. If two requests race, the database refuses the second instead of leaving two valid codes. Used/replaced codes are kept as history without blocking anything. |
| `subscriptions_expiring_idx` `(expires_at) WHERE status IN (TRIAL, ACTIVE, GRACE_PERIOD, CANCELLED_ACTIVE)` | Background job finding subscriptions about to end. | Expired rows (the majority over time) never need that scan. |

Important: for Postgres to use a partial index, the query's WHERE must **include the index condition**. That is why every "live user" query has `deletedAt: null` and every "live session" query has `revokedAt: null`. Because the email unique index is partial, Prisma has no `findUnique({ email })`; we use `findFirst({ email, deletedAt: null })`.

**GIN index** `coach_profiles(specialties)`: for array/JSON/text-search columns ("does the array contain 'Burnout'"). A B-tree can't do that.

**CHECK constraints**: the database refuses bad data even if app code has a bug.
- `users_email_lowercase_chk`: `email = lower(email)`
- `chats_direct_key_check`: a DIRECT chat has a `direct_key`, a GROUP has none
- `chat_members_last_read_sequence_number_check`, `chats_last_message_sequence_number_check`: counters never negative
- `chats_group_title_check`: a GROUP always has a title (1 to 60 characters); `chats_description_length_check`: a description is at most 300
- `verification_codes_failed_attempts_chk`: wrong-guess counter can't go negative

**Planned indexes (not created yet, with the use case)**
| Where / when | Index | Why |
|--------------|-------|-----|
| People search (step 1.4) | `pg_trgm` GIN on `lower(users.name)` | `ILIKE '%ana%'` can't use a B-tree because of the leading `%`. Trigram index makes substring search fast. |
| Chat (Phase 7) | UNIQUE `messages(sender_id, client_message_id)` | Idempotency: a retried send can never create a duplicate message. |
| Chat | `messages(chat_id, sequence_number)` | Fetch history pages and "everything after seq N" after reconnect. |
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

**Why the guard also reads the database** (`session-auth.service.ts`, called by `jwt-auth.guard.ts` and by the socket gateway)
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
| `POST /auth/register` | public | Always creates a `MEMBER`. Needs `dateOfBirth` ("YYYY-MM-DD", a real day, not in the future, any age). Extra fields (e.g. `role`) are rejected (400). |
| `POST /auth/register-coach` | public | A coach applies: the member fields plus `phone` (admins only ever see it), `bio` (20 to 600 characters) and 1 to 5 `specialties` from the fixed list `COACH_SPECIALTIES`. Creates a `COACH` with `coach_profiles.is_approved = false`, emails the verification code and returns a session (needed to type the code). Until an admin approves, the account is gated: see "Coach sign-up and approval" below. |
| `POST /auth/login` | public | MEMBER/COACH only. A coach who verified the email but is not approved yet gets 403 `COACH_PENDING_APPROVAL` and NO session (checked after the password, so nothing leaks to strangers). A coach who has not verified yet may sign in (to finish the code), but the gate below still applies. |
| `POST /auth/refresh` | public (needs refresh token) | Works for mobile and admin sessions. |
| `POST /auth/logout` | any token | Revokes current session. 204. |
| `GET /auth/me` | any token | Profile + subscription + `canCall`. |
| `POST /auth/email/send-code` | any mobile token | Emails a new 6-digit code (10 min). 429 `CODE_COOLDOWN` + `retryAfterSeconds` if asked within 60 s. 409 `ALREADY_VERIFIED`. |
| `POST /auth/email/verify` `{code}` | any mobile token | 200 `{emailVerified:true}`. 400 `INVALID_CODE` (+`attemptsLeft`), `CODE_EXPIRED`, `CODE_LOCKED` (5 wrong guesses). |
| `POST /auth/password/forgot` `{email}` | public | Step 1. Emails a 6-digit reset code. **Unknown email -> 404 `ACCOUNT_NOT_FOUND`** (product decision: the app then offers "Create an account"; trade-off: anyone can check whether an email has an account, limited by the 10/min throttle). Inside the 60 s cooldown it answers 200 with the seconds left and sends nothing. Mail failure -> 503 `EMAIL_SEND_FAILED` and the code is retired, so retrying works at once. Mobile users only (staff skipped). |
| `POST /auth/password/verify-code` `{email, code}` | public | Step 2. Right code -> `{resetToken, expiresInSeconds}` (10 min). Wrong/expired/locked -> 400 `INVALID_CODE` (+`attemptsLeft`), `CODE_EXPIRED`, `CODE_LOCKED`. |
| `POST /auth/password/reset` `{resetToken, newPassword}` | public | Step 3. Sets the password, **signs out every device** (`PASSWORD_CHANGED`), marks the email verified, writes an audit row. Bad/expired/used token -> 400 `RESET_TOKEN_INVALID`. |
| `POST /admin/auth/login` | public | SUPPORT/ADMIN only. Issues an `admin`-audience token. |
| `GET /admin/users?q=&role=&status=&cursor=&limit=` | SUPPORT, ADMIN | The admin user list: search by name or email, filter by role and by `status=banned` or `status=pending` (coaches not yet approved, including a coach with no profile row). Newest first, cursor paging (uuid v7 ids are time-ordered, so the cursor is the last id). Also `status=unverified` (email code never entered). Returns `{items: [{id, email, name, role, bannedAt, isApproved, emailVerified, phone, dateOfBirth, coach: {bio, specialties} | null, createdAt}], nextCursor}`; `isApproved` is null for non-coaches; `phone` is null for SUPPORT (admins only). |
| `POST /coaches/me/availability` `{available: boolean}` | COACH (approved) | A coach switches "Available now" on or off. Sets `coach_profiles.is_available` for the caller only (the id comes from the token, never the body). Answers `{available}`. Repeating is harmless; members get 403; a coach still waiting for approval gets 403 `COACH_PENDING_APPROVAL`. `GET /auth/me` returns `isAvailable` (coaches; null for everyone else). People shows the change on the next load: the Coaches list, the "Available now" filter and the Call button state. |
| `GET /admin/stats` | SUPPORT, ADMIN | The dashboard numbers, read-only, one request. `{users: {members, approvedCoaches, pendingCoaches, unverified, banned}, signups: {last7Days, daily[14 days, oldest first, every day present]}, chats: {direct, group, active7Days}, messages: {last24Hours, last7Days}, awaitingApproval[oldest 5]}`. Staff and deleted accounts are never counted; every figure is a database COUNT (`AdminStatsService`); the daily series uses `generate_series` so empty days show as 0. The to-do list leaves out banned coaches (the pending number still includes them). |
| `GET /admin/users/:id` | SUPPORT, ADMIN | Read-only user detail. |
| `POST /admin/coaches/:id/approve` | ADMIN only | Sets `coach_profiles.is_approved`. Approved coaches appear in the app's People list and can be messaged. 400 `NOT_A_COACH`, 404 `USER_NOT_FOUND`. Answers `{isApproved, changed}`; repeating is harmless (`changed: false`, no second audit entry). Audit `coach.approve` in the same transaction. After the commit the coach gets the email "Your Coach Connect application is approved" (`coachApprovedEmail`); a mail failure is only logged, the approval stays. Repeating sends no second email. There is no "un-approve": to take a coach away, ban them (section 7). |
| `POST /admin/users/:id/ban`, `/unban` | ADMIN only | See Section 7. |
| `GET /people?kind=coaches\|members&q=&specialty=&available=&cursor=&limit=` | any logged-in mobile user | Hides yourself and banned/deleted accounts, unapproved coaches. Returns no email. `q` = part of a name, any case. `specialty` / `available=true` apply to coaches only. Returns `{items, total, nextCursor}` (+ `specialties`: all specialties on offer, coaches tab only, for the filter chips); send `nextCursor` back as `cursor` for the next page (`null` = last page). Bad cursor -> 400. |
| `GET /chats` | mobile user | My chats, newest first (max 50). A direct chat shows once it has a message, a group from the moment it is created. Each item: `{id, type, title, other, description, memberCount, lastMessageSequenceNumber, unreadCount, lastMessage{senderName,...}, canSend}`. Chats with a BANNED person stay (read-only, `canSend: false`); only chats with a deleted account are left out. |
| `POST /chats` `{userId}` | mobile user | Start or reopen the chat with someone (same chat both ways). 404 `USER_NOT_FOUND` for self/unknown/banned/staff/unapproved coach. |
| `POST /chats/groups` `{title, description?, memberIds[]}` | mobile user | Create a group. The caller is added automatically; 3 to 6 people in total (`memberIds` has 2 to 5); at most ONE coach among them, the caller included (400 `GROUP_ONE_COACH_ONLY`); everybody must be someone you could chat with (404 `USER_NOT_FOUND` otherwise); 400 `CANNOT_ADD_SELF`. Pushes `chat:created` to every member. No media for now. |
| `POST /chats/:id/members` `{memberIds[]}` | group creator | Add people to a group (1 to 5 ids). Only the creator (403 `NOT_GROUP_CREATOR`; 404 for someone not in the chat; 400 `NOT_A_GROUP` for a direct chat). Same rules as creating, re-checked inside ONE transaction that locks the chat row (`SELECT ... FOR UPDATE`), so two adds at once cannot pass 6 people or two coaches: 400 `GROUP_FULL`, `GROUP_ONE_COACH_ONLY` (a banned coach still in the group counts), `ALREADY_IN_GROUP`, `CANNOT_ADD_SELF`, 404 `USER_NOT_FOUND`. A new member starts with everything marked read (their `last_read_sequence_number` = the chat's last number) but can read the earlier history. Pushes `chat:created` to the new people and `chat:updated` to those already in it. Returns the group detail. |
| `DELETE /chats/:id` | group creator | Delete a group for everybody: the chat, its members and ALL its messages (cascade). Permanent. Audited in the same transaction (`chat.delete_group`, metadata title + memberCount). Pushes `chat:deleted` to every member. 400 `NOT_A_GROUP` for direct chats. |
| `GET /chats/:id` | chat member | The chat with its people: `{...summary, members[{id,name,role,isBanned}], createdById}` (the group info screen). |
| `GET /chats/:id/messages?before=&after=&limit=` | chat member | Newest page by default; `before=N` older; `after=N` newer (catch-up). Oldest first. Also `lastMessageSequenceNumber`, `otherLastReadSequenceNumber`, `hasMore`. Non-member -> 404. |
| `POST /chats/:id/messages` `{clientMessageId, body}` | chat member | Saves a message (1-2000 chars, trimmed). **Idempotent**: same `clientMessageId` returns the first message with `duplicate:true`. 403 `CANNOT_MESSAGE` if blocked/banned recipient. |
| `POST /chats/:id/read` `{upToSequenceNumber}` | chat member | "I have seen up to N". Only moves forward, capped at the newest message. |
| `GET /health` | public | |

Rate limit: 120 req/min per IP globally, **10/min on login/register/refresh** (HTTP 429). (Per-IP only for now; add per-account lockout later.)

---

### 5.5 Forgot / reset password (3 steps, 3 screens)
- Built on the shared `VerificationCodeService` (`auth/verification-code.service.ts`): `cooldownLeft`, `issue`, `retire`, `verifyAndRun`. Email verification and password reset use it with different `purpose` values, so a code for one never works for the other (tested).
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

### 5.9 Chat (Phase 7: REST for actions, sockets for live updates; see 5.10)
- **Tables:** `chats` (`type` DIRECT/GROUP, unique `direct_key` = the two ids smaller-first, so A-to-B and B-to-A are the same row), `chat_members` (junction, one row per user per chat, holds `last_read_sequence_number`) and `messages` (`sequence_number` = 1,2,3 inside the chat; unique `(chat_id, sequence_number)` and unique `(sender_id, client_message_id)`). Only DIRECT is implemented; a group chat needs the same tables.
- **Message numbers without races:** one `UPDATE chats SET last_message_sequence_number = last_message_sequence_number + 1 ... RETURNING` inside the transaction takes the next number; the row lock makes parallel sends queue up (tested with 9 at once: numbers 1..9, no gaps).
- **Idempotent send:** the app makes a `clientMessageId` for every message. A retry after a bad connection returns the same saved message, so nothing is duplicated (also when two identical requests race: the unique index decides and the loser fetches the winner).
- **"Seen" is one number per member:** sending a message moves the sender's own `last_read_sequence_number` to it; opening a chat sends `POST /chats/:id/read` which does `UPDATE chat_members SET last_read_sequence_number = N WHERE ... AND last_read_sequence_number < N` (one row, and nothing is written when it would not move forward). `unreadCount = last_message_sequence_number - my last_read_sequence_number`. "Seen" on my message = the other member's number >= its `sequence_number`. For a group the same numbers answer "seen by whom" (`>= N`) and "seen by all" (`MIN`).
- **Privacy:** only members of a chat can read it (others get 404, not 403). Blocks hide the chat and stop sending; banned or deleted people are hidden.
- **Mobile:** `Messages` (list, unread badge, reloads when the server pushes a change), `Chat` (inverted list, bubbles, "Sending… / Not sent, tap to retry / Sent / Seen", loads older on scroll up, shows pushed messages live), `useChat` hook, `chatApi`. The chat opens as a layer over the tabs (from a Messages row or the chat button in People). Message numbers (`after=N`) are the catch-up cursor.
- **Group chats (built 2026-10-28):** `POST /chats/groups` creates a `GROUP` chat: a name (1-60), an optional description (up to 300), 3 to 6 people in total including the creator, **at most one coach** (the creator counts: a coach who creates a group cannot add another coach). No media for now. The rules are checked in `ChatService.createGroup` (and again in `addMembers`, inside one transaction that locks the chat row, so two simultaneous adds cannot break the size or the one-coach rule). The group shows in every member's Messages list at once (`last_message_at` is set at creation) and a `chat:created` event reloads the list on their phones. In the chat, other people's names appear above their bubbles (once per run), "Seen by all" means everybody still active has read it, and the header opens Group info (description and people, coach first). The Call button says group calls are coming soon (6 people = 1 caller + 1 coach + up to 4 members, the same size as the planned group call). Phone side: `screens/home/newGroup/` (picker with Members/Coaches tabs; rows that would break a rule are greyed out and say why, rules in `groupRules.ts`) and `screens/home/groupInfo/`.
- **Blocking was removed (2026-10-28):** the `user_blocks` table, the Prisma model and every check in People and chat are gone (nothing could create a block and the app never offered it). A ban is the only way an account is cut off, and it is an admin decision.
- **Add people and delete group (built 2026-10-28, creator only):** Group info shows "Add people" (hidden at 6 people) and "Delete group" (confirm dialog) when `detail.canManage` is true. Add people is the same picker as New group (`usePeoplePicker` + `PickerParts`), with people already in the group greyed out ("Already in the group") and the room left = 6 minus the current count (`groupRules.ts`, optional `ExistingGroup`). Live updates are handled once, in `useUnreadTotal` (mounted by Main): `chat:updated` reloads the list and that group's info; `chat:deleted` removes it from the cache, and if I am inside it sends me to the tab bar with "This group was deleted.". The person who deleted already cleaned up, so they get "Group deleted." only (`navigation.isFocused()` guards the second pop: the push can arrive before the HTTP answer). The chat header's "N people" comes from the route params when the chat opened, so it is not live.
- **Coach sign-up and approval (built 2026-10-29).** The flow: the coach fills the form in the app (Create account -> "Are you a coach? Apply here") -> `POST /auth/register-coach` -> the app asks for the 6-digit email code (same screen as members) -> the "Application received" screen -> an admin sees the application in Users & coaches (tag **Pending approval**, **Unverified** until the code is typed; Details shows date of birth, phone, specialties and bio) -> Approve -> the coach gets an email -> they sign in and appear in People. **The gate** lives in `SessionAuthService.authenticate`: a coach without `is_approved` gets 403 `COACH_PENDING_APPROVAL` on every route except those marked `@AllowPendingCoach()` (`/auth/me`, send-code, verify-email, logout; refresh is public), and cannot open the live socket. It reads the database row, so approval (or a ban) applies on the very next request with the token the coach already holds. The app shows `PendingApproval` when `user.pendingApproval` is true (`PublicUser.pendingApproval = role COACH and not approved`) and re-checks `/auth/me` on "Check again" and whenever the app returns to the front. Date of birth is typed as digits and dashes are added while typing (no date-picker library, so no native module). Phone numbers are never returned by People or chat.
- **Not built yet (Phase 7 remainder):** leaving a group; sending through the socket instead of REST, a Redis adapter for several API servers, offline outbox that survives app restarts (planned in 5.11), typing, images, push notifications, day separators. The REST endpoints stay: they are also the catch-up path after a reconnect.

### 5.10 Real-time (Socket.IO)
**Idea:** the app used to ask "anything new?" every 3-5 seconds. Now the server PUSHES a small event when something changes. Sending and reading stay normal REST calls (tested, retryable, idempotent); the socket only carries server-to-app notifications. An event just says "something changed": the app can always fetch the truth with REST, so a lost event never loses a message.

**Pieces and where they live**
| Piece | File | Job |
|---|---|---|
| Event names and payload types | `packages/shared/src/realtime.ts` | `message:new` `{chatId, message}`, `chat:read` `{chatId, userId, lastReadSequenceNumber}`, and `chat:created` / `chat:updated` / `chat:deleted` `{chatId}` (a group appeared, its people changed, it was deleted). One contract for API and app. |
| "Is this token good right now?" | `apps/api/src/auth/session-auth.service.ts` | The checks that used to live in the guard (signature, audience, session revoked or expired, user banned or deleted). Used by BOTH HTTP and sockets. |
| The door | `apps/api/src/realtime/realtime.gateway.ts` | Socket.IO on the same port as HTTP. Middleware checks the handshake token before accepting; an accepted socket joins its room `user:<id>`. |
| The only API other code uses | `apps/api/src/realtime/realtime.service.ts` | `emitToUsers(userIds, event, payload)` and `disconnectUser(userId)`. Chat, ban and password reset call these; they never touch Socket.IO. |
| Pushes | `chat.service.ts` | After the transaction commits: `message:new` to every member (not for retries), `chat:read` to every member (only when the number really moved forward), and for groups `chat:created` (new members), `chat:updated` (members already in it) and `chat:deleted` (every member). |
| Kicks | `ban.service.ts`, `password-reset.service.ts`, `auth.service.ts` | After the commit: ban and password reset call `disconnectUser` (all of the user's devices); logout, stolen-refresh-token detection and a same-device re-login call `disconnectSession` (only that login's socket, via the room `session:<id>`). |
| The connection | `apps/mobile/src/service/socket/socket.ts` | One shared socket. Token comes from the auth store on every (re)connect; `INVALID_TOKEN` -> refresh and retry; session-ended codes -> sign out; a server hang-up is answered by knocking again. |
| Open and close | `apps/mobile/src/navigations/RootStack.tsx` | Connected exactly while `status === 'signedIn'`; reconnects when the app returns to the foreground. |
| Open chat | `useChat.tsx` | Listens to both events. A pushed message with a gap before it triggers a catch-up fetch (`after=newest`). Also catches up on `connect` and when the app becomes active. |
| Messages list | `useMessages.tsx` | Both events and `connect` invalidate the `['chats']` query. |

**Why a room per USER and not per chat:** nobody has to "join a chat" (so no join-permission code to get wrong), the Messages list hears about every chat, and a group chat later is just a longer list of members to emit to.
**Why emit after the commit:** nobody is told about a message that failed to save, and a receiver that reacts at once by fetching never reads data that is not committed yet. `RealtimeService.emitToUsers` also swallows (and logs) a push failure: the database change already succeeded, so the request must not turn into an error.
**Session ended while the app runs:** the server closes the socket (see Kicks). The app sees `disconnect` with reason `io server disconnect`, knocks again, and the handshake answers with a code: `ACCOUNT_BANNED` or `SESSION_REVOKED` signs the user out, `INVALID_TOKEN` refreshes the token and reconnects. A plain network error is retried by Socket.IO. Not covered: a session that merely reaches its inactivity `expires_at` keeps an already-open socket until the next reconnect.
**Tests:** `apps/api/test/realtime.e2e-spec.ts` (real sockets: bad tokens refused, members get events and outsiders do not, retries push once, read pushes only on progress, a ban, a logout or a same-device re-login closes the right socket). Mobile tests play the server with `test-utils/socket.ts` (`fakeSocket.receive(...)`).
**Limits:** iOS closes sockets in the background (catch-up on foreground covers it; push notifications are a later phase). One API instance only; several need `@socket.io/redis-adapter`.

### 5.11 Connection banner, unread badge, and the offline outbox plan

**Connection banner** (`CustomConnectionBanner`, shown in the chat under the header). `service/socket/socket.ts` writes the socket state into `connection.store` (`idle` / `connecting` / `connected` / `disconnected`); `useConnectionBanner` shows the banner only after the connection has been down for 2 s (so a quick reconnect when the app returns to the foreground does not flash it) and hides it the instant it is back. "connecting" and "disconnected" alternate while Socket.IO retries, so both count as "down" and the banner stays steady. Closing the socket on purpose (sign out) is `idle`, never a banner.

**"Not sent. Tap to retry"** appears on a message when its send request FAILS (`deliver` in `useChat`). It is a different signal from the banner: the banner is about the live socket, the message mark is about that one REST request. Cases:
- no internet, server down, or no answer within 15 s (`NETWORK_ERROR`, the common one)
- server errors (500 and friends, e.g. during a deploy)
- 403 `CANNOT_MESSAGE`: the other person in a direct chat was banned or deleted their account (the app then turns the chat read-only)
- 404 `CHAT_NOT_FOUND`: you are not a member of that chat any more
- 429: too many requests (the default limit is 120 per minute)
- 400 / 409: bad input or a reused message id (should not happen from the app)
It does NOT appear when only the socket is down but the internet works: the send is a normal request and goes through (the banner shows meanwhile). A session that ended (revoked or banned) signs the user out instead of marking the message. Tapping the message retries with the SAME `clientMessageId`, so even if the first attempt reached the server and only the answer was lost, nothing is saved twice.

**Unread badge** on the Messages tab (sum of every chat's `unreadCount`, "99+" above 99). `Main` (the tab bar screen, mounted on every tab and while a chat is open) calls `useUnreadTotal`: it owns the shared `['chats']` query and patches it from socket events with the pure helpers in `screens/home/messages/chatsCache.ts` (`message:new` -> preview, unread +1 and move to top; my own `chat:read` -> unread down), with no request. It reloads only when it cannot be sure (a missing message number, a chat it has not seen), when the socket reconnects and when the app returns to the foreground. A message in the chat that is open is not counted (`activeChat.store`), and when the open chat marks messages read, `useChat` patches the cache from the REST answer so the badge is right even with the socket down. The number covers the 50 most recent chats (the list's limit) and leaves out chats hidden because the other person is banned, deleted or blocked.

**Offline outbox (planned, NOT built).** Goal (Gate 7): a phone sends 200 messages offline, closes and reopens the app, and they arrive once and in order. Today an unsent message lives in memory only.
- *Storage:* SQLite via `@op-engineering/op-sqlite` (re-add it, `pod install`, pin the version; see 1.2). Table `outbox(seq INTEGER PRIMARY KEY AUTOINCREMENT, user_id, chat_id, client_message_id UNIQUE, body, created_at, status, attempts)`; `seq` is the send order.
- *Send path:* typing Send first INSERTs the row (so it survives a crash), shows the bubble as "Sending…", then a single flusher sends rows one at a time, oldest first, per chat. Today's sends are parallel, which can reorder two quick messages: the flusher fixes that.
- *Results:* success -> delete the row (the server's answer, or the pushed `message:new` with the same `clientMessageId`, both settle it); network error or 5xx or 429 -> keep the row, stop, retry with backoff (1 s doubling to 30 s) and also when the socket connects, the app returns to the foreground, or the chat opens; permanent 4xx (403 CANNOT_MESSAGE, 404) -> mark `failed` and show "Not sent. Tap to retry" or delete.
- *Why nothing is duplicated:* the id is stored with the row; if the app dies after the server saved the message but before the row was deleted, the retry returns the first message (`duplicate: true`).
- *Rate limit:* 200 queued sends exceed the 120 per minute default, so either raise the limit for `POST /chats/:id/messages` or add a batch endpoint, and treat 429 as "wait and retry" (honour `Retry-After`).
- *Privacy:* rows carry `user_id` and are wiped on sign out, so one account's queue never sends as another.
- *Loading:* open the database lazily when a chat opens or the flusher starts, not at app launch (startup time).
- *Tests:* a fake in-memory database behind the same interface; "restart" = new module instance reading the same fake; assert order, once-only, backoff, 429 handling; plus an API test that 200 sequential sends with the same ids twice leave exactly 200 messages in order.

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
1. **One transaction:** set `banned_at` (the reason and the admin go only into the audit entry) → revoke every live session (`BANNED`) → write audit entry `user.ban`.
2. After the commit `BanService` calls `RealtimeService.disconnectUser`, which closes the user's open sockets at once (the app then tries to reconnect, is told `ACCOUNT_BANNED` and signs out). Calls (later) will also end active calls and remove the user from LiveKit rooms (target: within 5 s).

Why it is immediate: the guard hits the database on every request, and sessions are revoked in the same transaction, so even a not-yet-expired access token is rejected on the next call (`401 SESSION_REVOKED`; with a surviving session it would be `403 ACCOUNT_BANNED`). Login and refresh also refuse. Unban clears `banned_at` but leaves old sessions dead: the user signs in again.

Idempotent: banning twice does nothing extra (and writes one audit row). Reason must be one of a fixed list (matches the admin UI).

**What a ban means for everyone else (decided 2026-10-28):**
- The banned person **disappears from People** (so nobody can start a new chat with them) and from the admin's "approved coaches" use: banning is the only way to take a coach away (there is no "remove approval").
- Their **chats stay in everybody's Messages list and the history stays readable**. In a direct chat nobody can write to them (`canSend: false`, 403 `CANNOT_MESSAGE`); the phone shows "<name> is no longer available. You can read this chat but not reply." instead of the text box. **Unban** reopens it.
- In a **group** the other members carry on; the banned member stays in the people list marked "No longer available" and their old messages stay. A banned member is ignored when working out "Seen by all", so they cannot freeze it.
- The banned person themself is signed out everywhere and cannot sign in.

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
| Chat = `chats` + `chat_members` (junction) + `messages`; read position is one number per member | "Seen" for 1000 messages is a single-row update, not a write per message; the same shape serves group chats later (`chats.type`), with no A/B column trick. | 2026-10 |
| A ban is one column, `users.banned_at`; reason and admin only in `audit_logs` | `is_banned`, `ban_reason`, `banned_by_id` repeated what `banned_at` and the audit entry already say. Add a `user_bans` history table only if the admin panel needs per-user ban history. | 2026-10 |
| `one_time_codes` renamed `verification_codes` | Says what it is for (verify email, reset password); "one time" described how it is used, not what it is. | 2026-10 |
| Real-time = Socket.IO server push, REST for actions, one room per user | Push removes the polling traffic; keeping send and read on REST keeps them idempotent, retryable and already tested; a user room needs no join logic. Calls will reuse the same socket. | 2026-10 |
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
    auth/    signIn, register, registerCoach, pendingApproval, forgotPassword, resetCode, newPassword, verifyEmail
    system/  splash, offline
    home/    main (tab bar), people, messages, chat, calls, profile
  service/
    api/*.api.ts             Plain request functions per domain (authApi, peopleApi, chatApi), typed with @coach-connect/shared
    setup/                   apiClient.ts (apiRequest + ApiError), withAuth.ts (token refresh), handleApiError.ts (error -> toast)
  store/                     auth.store.ts, toast.store.ts (Zustand), secureStorage.ts (Keychain)
  utils/                     helpers/ (passwordRules, time, validation), hooks/ (useCountdown, useDebounced), service/socket/ (the one Socket.IO connection), types/ (navigationType)
__tests__/                   mirrors src/ (screens, components, service, store, utils) + App.test.tsx (real navigation)
test-utils/                  render (with React Query), byLabel/press/typeInto helpers, navigation mock
```
Import alias: `@/` = the `apps/mobile` folder (`@/src/components`). It is set in `tsconfig.json`, `babel.config.js` (module-resolver) and `jest.config.js`.

**Deliberate differences from the boilerplate**
- Bare RN, not Expo (no `app.config.ts`, `ios/` and `android/` are committed). Keychain instead of `expo-secure-store`; no MMKV yet.
- `fetch` + our own `ApiError(status, code, message, data)` instead of axios + `handleRequest`. Hooks *throw* (React Query expects it) and the toast shows `error.message`; `code` drives behaviour.
- No `react-native-responsive-screen` / `RFValue`: sizes are plain points taken from the design.
- Chat messages use our own hook (`useChat`: optimistic send, retry with the same `clientMessageId`, live updates from the socket) instead of React Query, because pending messages and "seen" do not fit a plain query. People and Messages use React Query (`useInfiniteQuery` / `useQuery`; Messages is invalidated by socket events).
- The bottom tab bar is hand-made (`home/main`), inside ONE native-stack screen. Native stack only (never `@react-navigation/stack`).

**Navigation = sign-in status.** `RootStack` shows a different group of screens per `auth.store` `status`: `signedOut` -> Sign in / Create account / Forgot password / Enter the code / New password; signed in but email not verified -> Verify email; `offline` -> Offline; otherwise Main + Chat. When the status changes the whole group swaps, so nobody can reach a signed-in screen while signed out and nobody calls `navigate()` after signing in. Forgot password passes data through route params (`ResetCode {email, resendSeconds}`, `NewPassword {resetToken}`); finishing it does `CommonActions.reset` to Sign in with `{passwordUpdated: true}`.

**Screen pattern.** `const SignIn: React.FC<Props> = ({ route }) => { const s = useSignIn(route.params); ... }`. The hook holds state, validation, API calls and navigation; the screen only draws. Tests mock the API module and `useNavigation` (see `test-utils/navigation.ts`) and assert on what the hook did.

**Errors as toasts:** server errors go through `service/setup/handleApiError.ts` (`showApiError`) and `CustomToastHost`; screens keep only field-level hints inline. Server validation answers look like `{ message: 'Validation failed', errors: { field: [messages] } }`; `apiClient` shows the first field message. Web still uses an inline banner.

Screens: `Splash` (green, determinate progress bar), `SignIn`, `Register`, `CustomCodeEntry` (shared by `VerifyEmail` and `ResetCode`: 6 boxes over ONE hidden input so paste/keypad/iOS autofill work; Verify button only after 6 digits; resend countdown), `ForgotPassword`, `NewPassword`, `Offline`, and the tabs **People** (design 07: debounced search, specialty chips, "Available now", cursor paging, specialty tag pills on coach cards), **Messages** (design 09), **Chat** (design 10), Calls (placeholder), Profile (temporary: shows `/auth/me` and has a dev button to spoil the token and test refresh). Native launch screens (iOS `LaunchScreen.storyboard`, Android `windowBackground`) are green too, so there is no white flash before the JS splash.

**Tests:** `pnpm test` in `apps/mobile` (or `pnpm turbo test`). Gotchas: `jest.setup.js` mocks `react-native-svg`, `react-native-safe-area-context`, and `@react-navigation/native` (hooks only: `App.test.tsx` opts out with `jest.unmock` to test the real stack); React Query's scheduler is made synchronous; `transformIgnorePatterns` lets Jest compile `@react-navigation`; in a real stack the earlier screens stay mounted, so `byLabel` returns the LAST (top) match; a timer that re-arms itself after each render needs one `act` per second; trees are unmounted after every test (`jest.setup.after.js`). Fonts (Bricolage Grotesque, Hanken Grotesk) are not bundled yet; system font is used.

**Run it on the iOS simulator:** (1) API running on port 3000, (2) `cd apps/mobile && pnpm dev` (Metro), (3) `pnpm ios` (or build in Xcode and open the app). Log in as `sara@coachconnect.dev` / `Password123!`. Placeholder to change before release: the iOS bundle id is still the template's `org.reactjs.native.example.CoachConnect` and Android's is `com.coachconnect`.

**Native paths in a monorepo.** Dependencies are hoisted to the repo root, so `ios/CoachConnect.xcodeproj` points `REACT_NATIVE_PATH` at `${PODS_ROOT}/../../../../node_modules/react-native` and `android/settings.gradle` includes `../../../node_modules/@react-native/gradle-plugin`. `metro.config.js` watches the root `node_modules` and `packages/shared`.

### 8b.1 Rendering rules (found by testing on an iPhone 17 Pro and an iPhone SE)
- **Keyboard and the bottom padding:** a bottom bar (chat composer, pinned buttons) carries extra padding for the home indicator. With the keyboard open that padding is an empty strip, so `useKeyboardVisible` (`utils/hooks`) drops it: the chat `Composer` uses 10 instead of the safe-area value, and `CustomWrapper` (with `keyboardAvoidingView`) shrinks a screen's bottom padding to 16.
- **Typing must not re-render the list:** the chat draft text and keyboard state live INSIDE the `Composer` component, the list data is `useMemo`'d and `Bubble` is `memo`'d, so a keystroke re-renders only the text box.
- **Larger system text (Dynamic Type):** text scales with the phone's setting, but headings, tab labels, chips, buttons, inputs and names sit in fixed layouts. They use `maxFontSizeMultiplier` from `MAX_FONT_SCALE` (`constants/theme/ui.ts`: title 1.3, chrome 1.2, control 1.3). Chat message text and plain body text stay uncapped on purpose (people who need big text still get it). New screens: add the cap to titles and anything in a pill, chip or fixed-height box.
- **Avatars:** the circle never shrinks in a crowded row (`flexShrink: 0`), its letters do not scale (`allowFontScaling={false}`), and initials are taken per character, not per UTF-16 unit, so an emoji is never cut in half (`initialsOf`).
- **Safe area:** every tab uses `insets.top + 12` for its top padding (Profile had a fixed 76, wrong on other phones) and a 20-point side margin.
- **Lists must not jump while searching or filtering (People):** (1) `refreshing` on a `FlatList` means "the user pulled down", NEVER "something is loading": on iOS the pull-to-refresh spinner pushes the whole list down, so `usePeople` keeps its own `pulling` flag; (2) while a new search loads, the old rows stay (`keepPreviousData`) and the list goes back to the top when the new rows arrive; (3) `items` is `useMemo`'d, `renderItem`/handlers are `useCallback`'d and `CustomPersonRow` is `memo`'d, so typing in the search box redraws no rows; (4) answers stay fresh 20 s (`staleTime`), so returning to a filter you just used shows it instantly with no background refetch. Found with a screen recording: `xcrun simctl io <device> recordVideo f.mp4`, then `ffmpeg -i f.mp4 -vf "fps=2,scale=230:-1,tile=6x3" sheet.png` to see motion that single screenshots miss; a temporary delay in the API call makes the loading state last long enough to see.
- **Connection banner and unread badge:** see 5.11. A new screen that shows live data should read `connection.store` (never the socket directly) and keep shared lists in the React Query cache so other screens (the tab bar) can use them.
- **Password fields:** `CustomTextInput` with `secureTextEntry` draws an eye button itself (starts hidden; tap to show, tap again to hide; each field has its own). Screens do not manage this. Labels "Show password" / "Hide password".
- **Profile tab:** identity (avatar, name, email, role) comes from the sign-in so it shows instantly; the membership comes from `GET /auth/me` and is explained in words by `describeMembership` (`screens/home/profile/membership.ts`: Active / Free trial / Payment issue / Cancelled / Expired / No subscription / Coach account, with the date). Pull down to refresh (spinner only for a real pull). Sign out asks first (`Alert`) and is a red outline button (`CustomButton variant="danger"`). The dev "expire my token" link is `__DEV__` only.
- **Email fields** (`keyboardType="email-address"`) turn off autocorrect and spell-check by default (`CustomTextInput`).
- **Socket vs sign-out:** the server closes the socket on logout; the store flag `signingOut` stops the socket code from treating that as "your session ended" (it used to show that banner after a normal sign-out).

### 8c. Admin web panel (`apps/web/`)
- **Stack:** Next.js (App Router) + TypeScript, plain CSS Modules with design tokens in `globals.css` (chosen over Tailwind: fewer new concepts for a first Next.js project; can be added later). Fonts: Bricolage Grotesque (headings), Hanken Grotesk (body).
- **Production = static export** (`output: 'export'`): plain files in `out/` that the NestJS backend will serve from the same address as the API, so the secure login cookie works and there is one deployable service. Consequence: no Next server features (rewrites, cookies(), server actions, route handlers using the request). All data comes from the backend API via `fetch` in the browser.
- **Development:** `pnpm dev` on port 3001; `next.config.ts` forwards `/api/*` to the backend (port 3000), so the browser sees one address. (Rewrites only exist in dev; static exports do not allow them.) TODO before deploy: make the backend answer under the path the built panel calls (e.g. serve the panel under `/panel` and keep API paths).
- `src/lib/api.ts` (one place for requests, `ApiError` with backend codes), `src/lib/session.ts` (sign in/out, `useSession()`), `src/components/AdminShell.tsx` (sidebar + frame, redirects to Sign in when signed out), pages: `/login`, `/dashboard`.
- **Temporary:** tokens are kept in page memory only (never localStorage), so a refresh signs you out. Next backend step: httpOnly cookie login + CSRF protection, then 2FA for ADMIN. Pages only use `session.ts`, so they won't change.
- Sidebar items without a page yet are shown greyed ("Coming soon"). Navigation uses Next's `Link` (client-side): a plain `<a>` reloads the page and, while the login lives only in memory, would sign the admin out.
- **Users & coaches page** (`/users`, `lib/admin.ts` + `app/users/`): search (sent 300 ms after typing stops), role and status filters, "Load more" paging, **Approve / Remove approval** for coaches, **Ban / Unban** with a confirmation row (ban asks for a reason and an optional note). Admin sees the buttons; Support sees the list read-only (the server also answers 403 to a Support write). Each click sends ONE request, then the row is updated from the answer without reloading the list. A slow old answer never overwrites a newer one (request counter). A 401 (the 15-minute login ran out) signs you out. Flow: filters -> `GET /admin/users?...` -> rows; Approve -> `POST /admin/coaches/:id/approve` -> `{isApproved}` -> that row's pill changes -> the member app's `GET /people?kind=coaches` includes the coach on its next load. How coaches get created is still a database/seed step (no "create coach" form yet).

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
- **Manual check list (mobile, on the simulator)** after any UI change: (1) every tab on iPhone 17 Pro and on iPhone SE (`xcrun simctl create` a "iPhone SE (3rd generation)"); (2) open the keyboard on Sign in, Create account, Forgot password, Search and the chat: no empty strip, the button and input stay visible; (3) a chat with a very long message, a long unbroken string, emoji and line breaks; (4) long names and many specialties in People; (5) system text size at accessibility-extra-large (`xcrun simctl ui <device> content_size accessibility-extra-large`) and back to `large`; (6) dark mode (the app stays light; the status bar must stay readable); (7) sign out: no "session ended" banner. Note: the simulator's typing tool can drop characters in long strings in a debug build; type in chunks or tap Sign in again before assuming an app bug.
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
- **2026-10-26, Auth flow (batch 2):** new splash (green, SVG "C inside C" logo, determinate bar) + green native launch screens; email verification backend (mailer, `verification_codes` (then called `one_time_codes`), HMAC codes, attempt limit, cooldown); Create account and Verify email screens; Root switch; backend 41 tests, mobile 63 tests.
- **2026-10-26, verified on the simulator:** splash, Sign in, Create account (live password tick), Verify email (wrong code -> "4 tries left", right code -> Home) against the real backend; fixed refocus bug; 64 mobile + 41 backend tests.
- **2026-10-26, admin web started:** Next.js 16 scaffold (static export in production, dev proxy), sign-in page (design A1) and dashboard shell (A2) connected to the real backend; session helper with logout; 8 admin tests. App icon added for iOS and Android. Port-in-use fix documented.
- **2026-10-27, forgot / reset password:** shared `VerificationCodeService` (then `OneTimeCodeService`; refactor, tests stayed green), `POST /auth/password/forgot` + `/reset` (no account leak, signs out all devices), mobile Forgot + Reset screens with shared CodeInput/ResendRow; verified end to end on the simulator. Backend 55 integration + 7 unit tests, mobile 79 tests.
- **2026-10-26, auth polish + real email:** errors shown as toasts in the app; password rule (lowercase + uppercase + number) with live checklist; "Open mail app" removed and Verify button appears at 6 digits; "Forgot password?" moved under the password field; reset is now 3 steps (email -> code -> new password) with a single-use reset token; unknown email says so and offers "Create an account"; mailer drivers `console`/`smtp`/`resend` with start-up validation and `pnpm mail:test`. Verified on the simulator end to end. Backend 68 integration + 20 unit tests, mobile 120 tests.

- **2026-10-26, People search (step 1.4b):** `q`, `specialty`, `available`, cursor paging, trigram index; separate verification/reset email templates; mail on port 465 note. Backend 73 integration + 21 unit tests.
- **2026-10-26, People screen (mobile):** tabs shell, Coaches/Members with search, specialty + "Available now" chips, paging, specialty tags on coach cards; backend returns the chip list. Verified on the simulator. Mobile 130 tests, backend 74 integration tests.
- **2026-10-26, chat (first slice):** conversations/messages tables, REST API (open, list, page, idempotent send, read receipts), Messages list and Chat room screens with polling. Verified on the simulator with a coach account answering via the API (message arrived, "Seen" shown). Backend 92 integration tests, mobile 148.
- **2026-10-26, monorepo refactor (boilerplate layout):** `mobile/`, `backend/`, `admin/` moved to `apps/mobile`, `apps/api`, `apps/web`; pnpm + Turborepo; new `packages/shared` (zod schemas, `API_ROUTES`, types, constants) and `packages/tsconfig`. API now validates with the shared zod schemas through a global `ZodValidationPipe` (class-validator DTOs removed), env validated with zod, OpenAPI at `/docs`. Mobile restructured to the boilerplate folders (`components/common/Custom*`, `screens/<module>/<screen>` + `hook/`, `service`, `store`, `constants`, `utils`), native-stack navigation driven by sign-in status, React Query for People/Messages/Profile. Backend 94 integration + 21 unit tests, mobile 155, web 8, shared 6.
- **2026-10-27, cleanup pass:** removed everything nothing imported: 17 unused native libraries from the app (list and how to restore them in section 1.2), the unused `push_tokens` table and `subscriptions.source/last_event_id` (migration `drop_unused_push_tokens_and_subscription_source`), the event emitter and the log-only ban listener, unused props/variants/theme tokens/exports, template READMEs, the mismatched root prettier config. Podfile is the standard RN one again. All suites green; iOS app rebuilt.
- **2026-10-27, database naming standard:** migration `standardize_column_and_table_names` (renames only, no data touched): `audit_log`->`audit_logs`, `blocks`->`user_blocks`, booleans got `is_`, abbreviations spelled out (`seq`->`sequence_number`, `attempts`->`failed_attempts`, `refresh_hash`->`refresh_token_hash`, ...), enum types snake_case. Full data dictionary in section 4.1b. 94 integration + 21 unit tests green.
- **2026-10-27, chat tables, bans, verification codes:** migration `chats_chat_members_banned_at_verification_codes` (data kept): `conversations` -> `chats` (+ `type`, `direct_key`, `title`, `updated_at`), new `chat_members` junction holding each user's `last_read_sequence_number` (replaces `user_a/b_last_read_seq` and the `user_a_id/user_b_id` pair), `messages.conversation_id` -> `chat_id`; `users.is_banned/ban_reason/banned_by_id` dropped (only `banned_at` stays, the admin user detail reads the reason from the audit log); `one_time_codes` -> `verification_codes`. API routes are now `/chats...` and chat fields use full names (`sequenceNumber`, `clientMessageId`, `lastMessageSequenceNumber`, `otherLastReadSequenceNumber`, `upToSequenceNumber`). 96 integration + 21 unit tests, mobile 155, shared 6, web 8.
- **2026-10-27, real-time chat (Socket.IO):** polling removed (3 s in a chat, 5 s on the list). New `SessionAuthService` (guard logic shared with sockets), `realtime/` module (gateway, `RealtimeService`), shared `realtime.ts`, mobile `service/socket`. New messages and reads are pushed; bans and password resets close sockets. `@nestjs/websockets` and `platform-socket.io` pinned to 12.2.0 to match `@nestjs/common` 12.2.0 (12.3.x needs a newer common). 101 integration + 21 unit tests, mobile 160.

- **2026-10-27, mobile rendering pass (iPhone 17 Pro + iPhone SE, large text, dark mode):** fixed the empty strip above the keyboard in the chat (and the oversized gap under pinned buttons on auth screens), typing re-rendering the whole chat list (draft state moved into `Composer`, list memoised), emoji names giving a broken avatar glyph, Profile using a fixed top padding and a different side margin, the "session ended" banner after a normal sign-out (socket reacted to the logout), spell-check squiggles in email fields, and several layouts breaking at large system text (titles, tab bar, avatars, segment control, chips, buttons, Profile rows). Rules are in section 8b.1. Mobile 177 tests (new: avatar initials, socket error handling).
- **2026-10-27, People list jump:** searching or tapping a specialty chip pushed the list down and back (the refresh spinner was tied to `isFetching`) and every keystroke redrew every row (new `items` array and `renderItem` each render). Fixed in `usePeople`/`People`/`CustomPersonRow` (rules in section 8b.1). Mobile 181 tests (4 new in People).
- **2026-10-28, connection banner and unread badge:** chat shows "Connection lost. Reconnecting…" after 2 s without the live connection; the Messages tab shows the total unread count, kept live from socket events (pure helpers + one shared `['chats']` cache entry, no extra requests). Offline outbox planned in 5.11. Mobile 212 tests.
- **2026-10-28, cleanup, password eye, Profile redesign:** audited the repo with four scripts (unused exports, files, dependencies, StyleSheet keys, theme tokens, API routes, env vars, class methods, Prisma fields, doc paths): everything else was already in use; removed only three needless `export` keywords. Password fields got a show/hide eye. Profile tab redesigned (plain-words membership, Sign out confirmation). Mobile 237 tests.
- **2026-10-28, People tabs:** the Coaches / Members tabs no longer show a count (it changed with every search and filter); the "N coaches" line above the list remains. SIGTERM in the API log traced to my own cleanup killing the user's server by port; rule saved (stop only the pids I start).
- **2026-10-28, admin: coach approval and user list:** `GET /admin/users`, `POST /admin/coaches/:id/approve` (audited), web page `/users` with Approve and Ban/Unban buttons, shared `escapeLike` helper (Prisma `contains` does not escape `%` and `_`). API 117 integration tests, web 19, shared 9.
- **2026-10-28, admin panel layout:** the sidebar is now pinned to the window (it used to grow with the page and push the signed-in name off screen) and the Actions header is right-aligned. Found while reviewing: removing a coach's approval only hides them from the member directory; their sessions stay open and they can sign in again. Decision pending (see the open question in the chat).
- **2026-10-28, groups, ban behaviour, no blocking:** migration `group_chats_drop_user_blocks` (adds `chats.description`, `chats.created_by_id`, group CHECKs; drops `user_blocks`, 0 rows). Group chats (create, info, names above bubbles, "Seen by all", one coach per group, 3 to 6 people), a banned person's chats stay readable but read-only, "Remove approval" removed from the admin panel and API (ban is the way to remove a coach), user blocking removed everywhere. API 136 integration tests, mobile 287, web 20, shared 13.
- **2026-10-28, add people to a group and delete a group (creator only):** `POST /chats/:id/members` (one locked transaction re-checks 6 people and one coach), `DELETE /chats/:id` (audited, cascade), events `chat:updated` and `chat:deleted`, `ChatDetail.canManage`. Phone: shared people picker, Add people screen, Group info buttons, live handling of the new events. Found by running it on the phone: the delete push returned the creator to the tab bar before the HTTP answer, then the second "go back" raised "POP_TO_TOP was not handled"; fixed with an `isFocused()` check and a test. API 156 integration tests, mobile 312.
- **2026-10-29, admin panel stays signed in:** the panel kept its tokens only in page memory and never renewed the 15-minute access token, so it signed the admin out after 15 minutes. `authedRequest` (web `lib/session.ts`) now renews it with the refresh token on the first 401 (one renewal shared by parallel requests; offline does not sign out) and repeats the request. A browser reload still signs out (decision: keep tokens in memory; the httpOnly-cookie login stays a later step).
- **2026-10-29, coach sign-up, approval email, date of birth, admin tags:** migration `user_phone_date_of_birth` (`users.phone`, `users.date_of_birth`, CHECKs); `POST /auth/register-coach`; `COACH_PENDING_APPROVAL` gate; approval email; admin list returns `emailVerified`, `phone` (admins only), `dateOfBirth`, coach bio and specialties, filter `status=unverified`; web Users tab shows several tags per row (Banned / Pending approval / Unverified / Approved / Active) and a Details row; mobile: date of birth on Create account, Apply as a coach form, waiting screen. Verified on the phone: apply -> code screen -> waiting screen -> approve -> "Check again" enters the app. API 171 integration tests, mobile 363, web 29, shared 17.
- **2026-10-29, admin dashboard:** `GET /admin/stats` and the `/dashboard` page: tiles for people (members, approved and waiting coaches, new this week, unverified, banned) and activity (messages 24h and 7d, active, direct and group chats), a 14-day sign-ups bar chart (one hue, thin bars, hover tooltip, "View as table" for screen readers) and the list of coaches waiting for approval. Checked in the browser against real data. API 178 integration tests, web 35.
- **2026-10-30, coach availability:** Profile tab has an "Available now" switch for coaches (instant, rolls back with the reason if the server refuses; People lists reload). `POST /coaches/me/availability`, `isAvailable` on `/auth/me`. Not pushed live: members see the change when People next loads (a live presence event can come with calls). Checked on the phone. API 186 integration tests, mobile 368.
