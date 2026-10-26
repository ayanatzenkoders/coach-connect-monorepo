# Coach Connect: Project Knowledge Base

The "why and how" of this codebase. Code shows *what*; this file explains *why* and records what we learned.

**Maintenance rule:** at the end of every phase (or when a decision/bug teaches something), add to the right section and
add a line to the [Changelog](#13-changelog). Keep entries short. If something here becomes wrong, fix or delete it.

Related docs: `Requirement & Design/Coach Connect Detailed Plan.md` (what to build, step by step).

---

## 1. Repo map

| Path | What |
|------|------|
| `mobile/` | React Native CLI app (TypeScript). iOS + Android. |
| `backend/` | NestJS API (TypeScript, ESM). Prisma + Postgres. |
| `admin/` | Next.js admin panel (TypeScript). Sign-in + dashboard shell so far. |
| `docker-compose.yml` | Local Postgres for people who use Docker. Bound to `127.0.0.1` only. |
| `Requirement & Design/` | PRD, UI design export, implementation plans. |
| `knowledge.md` | This file. |

## 2. Run it locally

```bash
# Database (pick one)
brew install postgresql@16 && brew services start postgresql@16     # then create role/db once (see Section 3)
docker compose up -d                                                 # or this

# Backend
cd backend
cp .env.example .env        # then set JWT_ACCESS_SECRET:  openssl rand -base64 48
npm install                 # also runs `prisma generate`
npm run prisma:migrate      # creates/updates tables
npm run db:seed             # dev users; every password is Password123!
npm run start:dev           # http://localhost:3000/health

# Tests
npm test                                              # fast unit tests
npx vitest run --config ./vitest.config.e2e.ts        # integration tests (uses coachconnect_test DB)
```

Seeded logins (password `Password123!`): `admin@coachconnect.dev` (ADMIN, use `/admin/auth/login`), `support@coachconnect.dev` (SUPPORT),
coaches `amara@`, `marcus@`, `lena@coachconnect.dev`, members `sara@`, `jonah@`, `rhea@`, `omar@`, `ivy@`, `leo@`, `nia@`, `tariq@coachconnect.dev` (members have an ACTIVE subscription).

One-time local DB setup (Homebrew):
```sql
CREATE ROLE coach WITH LOGIN PASSWORD 'coach_dev_password' CREATEDB;  -- CREATEDB: Prisma makes a temp "shadow" DB for migrations
CREATE DATABASE coachconnect OWNER coach;
CREATE DATABASE coachconnect_test OWNER coach;                         -- used only by integration tests
```
Then once: `DATABASE_URL=postgresql://coach:coach_dev_password@localhost:5432/coachconnect_test npx prisma migrate deploy`.

## 3. Tooling gotchas we hit (save yourself the time)

| Symptom | Cause / fix |
|---------|-------------|
| `pod install` crashes with `Unicode Normalization not appropriate for ASCII-8BIT` | Run with `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8`. |
| iOS link error `_kUTTypeImage` in `react-native-image-picker` | Dynamic frameworks need Apple frameworks linked by hand; fixed in `mobile/ios/Podfile` `post_install`. |
| Podfile uses dynamic frameworks | Required by React Native Firebase v27 (SPM). |
| `npm install` fails with `edgesOut` in `backend/` | Use `--legacy-peer-deps` (Nest 12 template has a peer conflict). |
| `npx prisma` shows a totally different CLI (v8 rc) | npm's `latest` tag was a release candidate. Pin `prisma@7.10.1` (same version as `@prisma/client`). |
| `zsh: command not found: psql -h ...` | zsh does not word-split a variable holding a command. Use a shell function, not a string variable. |
| `curl -H $J` sends no JSON content type in zsh | Same reason. Quote headers inline: `-H "Content-Type: application/json"`. |
| Nest 12 template uses **Vitest** (not Jest) and ESM | Imports need the `.js` suffix even in `.ts` files. Test globals work (`describe`, `it`). |
| `EADDRINUSE: address already in use :::3000` (backend) or `:::8081` (Metro) | An earlier server is still running (often one started in a background session). Find it: `lsof -nP -iTCP:3000 -sTCP:LISTEN`, check the command, then `kill <pid>`. Do the same for 8081 (Metro) and 3001 (admin). Ports: backend 3000, admin 3001, Metro 8081. |
| `pod install` after adding a native package (e.g. `react-native-svg`) | Required, then rebuild the iOS app. Metro hot reload only covers JavaScript. |
| Times stored 5 h off in Postgres (UTC+5 machine) | Prisma sends dates as UTC text without an offset; a non-UTC connection stores the wrong instant. Fixed by `options: '-c timezone=UTC'` in `PrismaPg` (`prisma.service.ts`, `seed.ts`). Regression test: `test/timezone.e2e-spec.ts`. Rows written before the fix in a dev DB are shifted; `npx prisma migrate reset` clears them. |
| App stuck on splash, red "required entitlement isn't present" | Keychain needs a SIGNED app. Do not build the simulator app with `CODE_SIGNING_ALLOWED=NO`; use `CODE_SIGN_IDENTITY="-" CODE_SIGNING_ALLOWED=YES` (normal Xcode/`npm run ios` builds are already signed). The app now also falls back to signed-out instead of hanging if Keychain fails. |
| Next.js 16 template: `cacheComponents` / `partialPrefetching` in `next.config.ts` | Removed: they need a Node server, but production is a static export. Also read `node_modules/next/dist/docs/` before using Next APIs; this version differs from older tutorials. |
| `vitest` (admin) fails with "Cannot find package 'vite'" | Vitest 5 needs `vite` installed next to it (`npm i -D vite`). |
| Hidden input loses focus after an error | Never call `.focus()` while the input is `editable={false}`. Refocus in an effect once `busy` is false (VerifyEmailScreen). |
| Simulator ignores taps / screen looks stale | Usually a stuck session after a first launch or Metro disconnect ("not responding for 60 seconds" in the Metro log). Terminate and relaunch the app (`xcrun simctl terminate/launch <device> org.reactjs.native.example.CoachConnect`). Capture exact frames with `xcrun simctl io <device> screenshot file.png`. |
| iOS "Save Password?" dialog appears after login in the simulator | Normal iOS autofill prompt (the password field has `textContentType="password"`). Tap "Not Now". It blocks taps until dismissed. |
| iOS simulator screenshots / taps seem to lag | The UI updates a moment after a tap; wait ~1-2 s before judging a screen. |
| `backend/src/generated/` missing after clone | It is generated, not committed: `npm run prisma:generate` (also runs on `npm install`). |

---

## 4. Database

Postgres 16. Prisma 7 (schema in `backend/prisma/schema.prisma`; connection URL lives in `prisma.config.ts`).
Tables: `users`, `sessions`, `coach_profiles`, `subscriptions`, `blocks`, `push_tokens`, `audit_log`.

### 4.1 Conventions
- **Primary keys: UUID v7** (`@default(uuid(7))`). Time-ordered, so new rows append to the end of the index (faster inserts, less bloat than random v4) and ids cannot be guessed like `1,2,3`.
- **Timestamps are `timestamptz`** (always carry timezone). Never plain `timestamp`.
- **Emails are stored lowercase** (CHECK constraint) and input is lowercased before use.
- **Soft delete** on users via `deleted_at`; "live" queries always include `deleted_at IS NULL`.
- **Raw SQL lives in the migration file** for anything Prisma can't express (marked `RAW`). Prisma does not drop them (verified: `migrate dev` reports "in sync").
- Never edit an applied migration. Add a new one: `npm run prisma:migrate -- --name what_changed`. Use `--create-only` to hand-edit the SQL first.

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

Implemented in `backend/src/subscriptions/subscription-access.ts` (`hasActiveAccess`), unit tested.

**`SubscriptionSource`**: `REVENUECAT` (store purchase) or `ADMIN_OVERRIDE` (free access granted by an Admin).

**`OneTimeCodePurpose`**: `EMAIL_VERIFICATION` (6-digit code after sign-up) or `PASSWORD_RESET` (used in the next step).

**`PushPlatform`**: `IOS_VOIP` (PushKit: rings the phone), `IOS_APNS` (normal iOS notifications), `ANDROID_FCM` (Android calls + chat).

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
| `push_tokens(user_id)` | "All devices of a user" when sending a call push, and when a ban deletes them. |
| `audit_log(actor_id, created_at)` | "What did this admin do, newest first." |
| `audit_log(target_type, target_id, created_at)` | "History of this user." |
| `audit_log(created_at)` | Global recent-activity feed. |

**Unique index**: the database guarantees no duplicates (even if two requests race). `push_tokens(token)`, `subscriptions(user_id)` (one row per user).

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
- **Ban**: user flag + revoke sessions + delete push tokens + audit entry all succeed together or not at all.
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
| Method + path | Auth | Notes |
|---------------|------|-------|
| `POST /auth/register` | public | Always creates a `MEMBER`. Extra fields (e.g. `role`) are rejected (400). |
| `POST /auth/login` | public | MEMBER/COACH only. |
| `POST /auth/refresh` | public (needs refresh token) | Works for mobile and admin sessions. |
| `POST /auth/logout` | any token | Revokes current session. 204. |
| `GET /auth/me` | any token | Profile + subscription + `canCall`. |
| `POST /auth/email/send-code` | any mobile token | Emails a new 6-digit code (10 min). 429 `CODE_COOLDOWN` + `retryAfterSeconds` if asked within 60 s. 409 `ALREADY_VERIFIED`. |
| `POST /auth/email/verify` `{code}` | any mobile token | 200 `{emailVerified:true}`. 400 `INVALID_CODE` (+`attemptsLeft`), `CODE_EXPIRED`, `CODE_LOCKED` (5 wrong guesses). |
| `POST /admin/auth/login` | public | SUPPORT/ADMIN only. Issues an `admin`-audience token. |
| `GET /admin/users/:id` | SUPPORT, ADMIN | Read-only user detail. |
| `POST /admin/users/:id/ban`, `/unban` | ADMIN only | See Section 7. |
| `GET /people?kind=coaches\|members&limit=` | any logged-in mobile user | Hides yourself, banned/deleted, blocked (both directions), unapproved coaches. Returns no email. Returns `{items, total}`. |
| `GET /health` | public | |

Rate limit: 120 req/min per IP globally, **10/min on login/register/refresh** (HTTP 429). (Per-IP only for now; add per-account lockout later.)

---

### 5.4 Email verification (6-digit code)
- **Sign-up** creates the user and emails a code. The app then shows "Check your email" until the code is entered; the account exists either way, so the back arrow just signs out and the user can verify later.
- The code is random (`crypto.randomInt`), valid 10 minutes, and stored only as an **HMAC** (hash with our secret). A plain hash of a 6-digit number could be reversed instantly if the database leaked; the HMAC cannot without the secret.
- **Limits:** 5 wrong guesses lock the code (counted atomically, so parallel guesses can't dodge it); one email per minute per user; routes are rate-limited.
- A new code retires the old one, so only one is ever valid.
- **Mailer:** `mail/mailer.service.ts` only PRINTS emails in the backend console in development (and tests read `outbox`). Before launch swap `send()` for an HTTP email provider; nothing else changes. **To test sign-up locally, read the code from the backend terminal.**
- The mobile app gates on `user.emailVerified`. The API itself does not yet refuse unverified users (decide later if calls should require a verified email).

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
1. **One transaction:** set `is_banned/banned_at/ban_reason/banned_by_id` → revoke every live session (`BANNED`) → delete all push tokens → write audit entry `user.ban`.
2. After commit, emit event **`user.banned`**. Today a listener only logs. Phase 3 (calls) and Phase 7 (chat) will attach listeners that disconnect sockets, end active calls and remove the user from LiveKit rooms (target: within 5 s).

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
| Ban listener is a stub that logs | Sockets/LiveKit don't exist yet; event contract is in place so no rewrite later. | 2026-10 |
| Docker Postgres bound to `127.0.0.1` | Publishing 5432 on all interfaces exposes the DB on public Wi-Fi with a password that is in git. | 2026-10 |
| Seed refuses `NODE_ENV=production` | Dev passwords must never reach a real database. | 2026-10 |

## 8b. Mobile app structure (`mobile/`)
| Path | What |
|------|------|
| `src/config.ts` | Backend URL per platform (iOS sim `localhost`, Android emulator `10.0.2.2`; real phone = your Mac's Wi-Fi IP). |
| `src/api/client.ts` | `apiRequest()`: the only way to call the backend. Failures become `ApiError(status, code, message)`; `status 0` = no network. |
| `src/api/authApi.ts` | Typed functions `login / register / refresh / logout / me`; types mirror the backend answers (checked against the live server). |
| `src/api/withAuth.ts` | Wrap every logged-in call: `withAuth((token) => authApi.me(token))`. Expired access token -> one shared refresh + retry; revoked/banned -> sign out; network error -> user stays signed in. |
| `src/auth/tokenStorage.ts` | Tokens + device id in Keychain/Keystore (`AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`: readable on a locked phone for incoming calls, never backed up). |
| `src/auth/authStore.ts` | Zustand store: `status` (booting / signedOut / signedIn / offline), `restore()` on app open (valid token -> in; expired -> silent refresh; revoked/banned -> out with a reason; no network -> `offline`, tokens kept), `signIn`, `register`, `signOut` (works offline). |
| `src/theme/` | Design tokens (colors, spacing, text) copied from the UI design. Screens never use raw colors. |
| `src/components/` | `Button`, `TextField`, `Logo` (the "C inside C" mark drawn with SVG: two open arcs facing each other with a dot between them), `icons` (back, check, dot). Shared by all screens. |
| `src/screens/` | One file per screen (`SignInScreen` so far). Screens take callbacks as props; wiring to the backend is done outside the screen. |
Screens so far: `SplashScreen` (green, logo tile, determinate progress bar: climbs to 85% while waiting, fills when ready, then hands over), `SignInScreen`, `RegisterScreen`, `VerifyEmailScreen` (6 boxes over ONE hidden input so paste/keypad/iOS autofill work; auto-submits at 6 digits; resend countdown), `OfflineScreen`, `HomeScreen` (temporary: shows the real `/auth/me` answer and has a dev button to spoil the token and test refresh). `App.tsx` picks the screen from `authStore.status`.
Native launch screens (iOS `LaunchScreen.storyboard`, Android `windowBackground`) are green too, so there is no white flash before the JS splash.
Tests: `npx jest` in `mobile/`. Testing gotchas: `jest.setup.js` mocks `react-native-svg`; a timer that re-arms itself after each render (countdowns) needs one `act` per second in tests; mock `react-native-safe-area-context` (its provider renders nothing in tests); in `act`, effects start only after the first block ends, so wait in a second `act`. Fonts (Bricolage Grotesque, Hanken Grotesk) are not bundled yet; system font is used.

**Run it on the iOS simulator:** (1) backend running on port 3000, (2) `cd mobile && npx react-native start`, (3) `npm run ios` (or build in Xcode and open the app). Log in as `sara@coachconnect.dev` / `Password123!`. Placeholder to change before release: the iOS bundle id is still the template's `org.reactjs.native.example.CoachConnect` and Android's is `com.coachconnect`.

### 8c. Admin web panel (`admin/`)
- **Stack:** Next.js (App Router) + TypeScript, plain CSS Modules with design tokens in `globals.css` (chosen over Tailwind: fewer new concepts for a first Next.js project; can be added later). Fonts: Bricolage Grotesque (headings), Hanken Grotesk (body).
- **Production = static export** (`output: 'export'`): plain files in `out/` that the NestJS backend will serve from the same address as the API, so the secure login cookie works and there is one deployable service. Consequence: no Next server features (rewrites, cookies(), server actions, route handlers using the request). All data comes from the backend API via `fetch` in the browser.
- **Development:** `npm run dev` on port 3001; `next.config.ts` forwards `/api/*` to the backend (port 3000), so the browser sees one address. (Rewrites only exist in dev; static exports do not allow them.) TODO before deploy: make the backend answer under the path the built panel calls (e.g. serve the panel under `/panel` and keep API paths).
- `src/lib/api.ts` (one place for requests, `ApiError` with backend codes), `src/lib/session.ts` (sign in/out, `useSession()`), `src/components/AdminShell.tsx` (sidebar + frame, redirects to Sign in when signed out), pages: `/login`, `/dashboard`.
- **Temporary:** tokens are kept in page memory only (never localStorage), so a refresh signs you out. Next backend step: httpOnly cookie login + CSRF protection, then 2FA for ADMIN. Pages only use `session.ts`, so they won't change.
- Sidebar items other than Dashboard are shown greyed ("Coming soon") until their pages exist.

### 8d. App icon
Source of truth: `mobile/scripts/generate-icons.mjs` (draws the "C inside C" mark; run `npm run icons` in `mobile/`). It writes `mobile/assets/app-icon.svg`, the iOS 1024 px icon (`AppIcon.appiconset`, no transparency; iOS rounds the corners) and Android legacy, round and adaptive icons (`mipmap-*`, `mipmap-anydpi-v26`, colors in `values/colors.xml`; mark kept inside the adaptive safe zone, also used as the Android 13 themed icon). Change the design in that script and re-run. Checked: iOS build shows it on the home screen; Android `mergeDebugResources` succeeds (not run on an emulator).

**Docs policy:** `Requirement & Design/` (client PRD, UI export, plans) is git-ignored and stays on your machine. Only `README.md` and `knowledge.md` are shared in the repo.

## 9. Security checklist (keep true)
- [ ] No secret in git: `.env*` ignored except `.env.example`; the mobile app ships no secrets.
- [ ] Every new route is protected by default; `@Public()` only where intended.
- [ ] Every admin write goes through a service that writes an audit row in the same transaction.
- [ ] Role/ban/subscription decisions read the database, never the token claims.
- [ ] Input is validated by DTOs; unknown fields rejected.
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
Phase 1 remaining: People step 1.4b (name search with trigram index, specialty filter, `availableOnly`, cursor pagination); Google/Apple sign-in, email verification and password reset (HTTP email provider needed). Then Phase 2 (mobile shell) and Phase 3 (calls).

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
