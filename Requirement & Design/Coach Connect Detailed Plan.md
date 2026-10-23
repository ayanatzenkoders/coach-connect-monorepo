# Coach Connect: Detailed Build Plan (v2, with Coach Group Calls)

Updates and replaces the call/People parts of `Coach Connect Implementation Plan.docx`.
Everything in the .docx that is not mentioned here still stands (stack, security, hosting, CI).

How to read this file:
- Part A explains what changed and the rules. Read it once.
- Part B is a plain-language glossary of the tech you said you haven't used.
- Part C is the step-by-step plan. Every step has **What / How / Learn / Done when**.
- Steps marked `[2-DAY]` are the ones that fit the 2-day slice (Part D). The rest come after.

---

## Part A. What changed

### A1. The new product rules (from the updated UI)

| # | Rule | Where in the UI |
|---|------|-----------------|
| R1 | Every user can see, chat with and call every other user. Two lists, split by role: **Coaches** and **Members**. | `07 People` |
| R2 | A call between two members is **one-to-one only**. No adding people. | `07 People` subtitle |
| R3 | A call to a **coach** can grow into a group: **1 dialer + 1 coach + up to 4 more members = 6 people max**. | `13 Coach call`, `13b Add members`, `13c Group coach call` |
| R4 | Only **members** can be added. **Coaches can never be added**, so there is exactly one coach per call. | `13b` ("Coaches can't be added") |
| R5 | Recording consent is asked from **everyone**, including people added later. Saying no does not end the call. | `13`, `13c` |
| R6 | The admin panel is **not updated yet**. The Coaches screen (a coach's own area) is also still open. | not designed |

### A2. This differs from the client's PRD. Get it approved.

The PRD says "Group calls support up to 4 participants" and "1-to-1 call between user and coach". The new rule is 6 people, and
members can call each other. This is a product change, so tell the client in plain words:

1. **What:** a member who calls a coach can bring up to 4 other members into the same call (6 people total).
2. **Why it is safe:** exactly one coach per call; the server (not the app) enforces every limit, so a modified app cannot cheat.
3. **It is a setting, not a rewrite:** the limit lives in one config value (`MAX_GUESTS_PER_COACH_CALL = 4`). If the client wants "4 total", we change one number.
4. **It costs more:** more people means more audio to transcribe (see A5). We flag it now rather than after launch.
5. **Schedule:** group calls are built after 1-to-1 calls work (Phase 4), so the first working demo does not depend on them.

### A3. Open decisions (I picked a default; confirm each with the client)

| ID | Question | Default used in this plan |
|----|----------|---------------------------|
| D1 | Total people per coach call | 6 (dialer + coach + 4). One config constant. |
| D2 | Who may add people | Only the **host** (the member who dialled). Not the coach, not other guests. |
| D3 | Do added members need a subscription? | **Yes.** Server refuses to give a call token to an unsubscribed member (PRD: "no call without an active subscription"). The picker shows only members who can join. |
| D4 | Do member-to-member calls get AI summaries? | **No** in the MVP. Summaries only for calls with a coach (that is what the UI shows). Saves cost and privacy risk. |
| D5 | When does a coach call end? | When the **coach leaves**, or fewer than 2 people remain. Anyone else can just "Leave". Coach gets a 15 s rejoin window for network drops. |
| D6 | Coach calls a member back ("Call back" in Coach mode) | Becomes a coach call; the called member is the host and can add people. |
| D7 | Can someone be in two calls at once? | **No.** Second call gets BUSY. Same for a coach. |
| D8 | Is chat gated by subscription? Does a coach need one? | Open in the original plan too. Default: chat open to all signed-in users; coaches never need a subscription. |
| D9 | What does the People list show about others? | Name, initials, role, online status, specialty (coaches). **Never email or phone.** |

### A4. Rules the server must enforce (never trust the app)

When someone calls `POST /calls/:id/invite`:

1. Caller is a participant of this call, is the **host**, and the call is `ACTIVE` or `RINGING`.
2. Every invited user has role `MEMBER` (coaches, support and admin are refused).
3. Not already in this call; not in another call (BUSY); not banned.
4. No block exists in either direction between invitee and host or coach.
5. Invitee has an active subscription (D3).
6. Seat count: guests currently `INVITED`, `RINGING` or `JOINED` must stay **<= 4**. Do this inside one database transaction that locks the call row, otherwise two quick taps can both pass the check and give you 5 guests.
7. LiveKit room is also created with `max_participants = 6` as a second safety net.

When someone calls `POST /calls` (start a call):
- Callee is a coach: caller must be a `MEMBER` with active subscription; coach must be available and not busy. Creates a `COACH` call.
- Callee is a member: caller must be subscribed and callee not busy. Creates a `MEMBER_DIRECT` call. Invite endpoint refuses on these calls (R2).
- Callee is a coach and caller is also a coach: refused (not in scope).

### A5. Cost warning from the new rule

The plan billed speech-to-text per audio track (about $0.0043 per track-minute). With 6 people that is about **$0.026 per call minute**,
above the plan's target of "under $0.01 per call minute". Ways to handle it, from cheapest to most work:
- Skip silent stretches before sending audio (voice-activity detection).
- Transcribe only the tracks that actually spoke.
- Raise the target and tell the client.
LiveKit Cloud's free recording minutes (60/month) also run out about 6x faster with 6 tracks. Self-host before the pilot.

### A6. Data model changes (on top of the .docx tables)

```
users            role: MEMBER | COACH | SUPPORT | ADMIN      (was CLIENT; renamed to match the UI)
blocks           blocker_id, blocked_id, created_at           (hide blocked people everywhere)

calls            + kind: MEMBER_DIRECT | COACH
                 + host_id          (member who dialled, or the member called back)
                 + max_participants (default 6, read from config at creation)

call_participants
                 + role_in_call: HOST | COACH | GUEST
                 + state: INVITED | RINGING | JOINED | DECLINED | MISSED | LEFT | REMOVED
                 + invited_by, invited_at
                 UNIQUE (call_id, user_id)
                 UNIQUE partial index: one row with role_in_call = COACH per call
```

Why per-participant state: in a group call each person has their own story (declined, missed, joined late, left early).
The admin call log and the AI summary both need it later, so we record it from day one even though the admin screens come later.

---

## Part B. Glossary: the tech in plain words

| Term | What it is | Where we use it |
|------|-----------|-----------------|
| **LiveKit** | A media server. Phones send audio/video to it and it forwards to the others. Replaces Agora in the plan. | All calls |
| **Room** | A virtual meeting space in LiveKit. One call = one room. | Calls |
| **Join token** | A short-lived pass signed by our server that lets one person enter one room. The app never holds the secret key. | Calls (this is how the server enforces limits) |
| **SFU** | "Selective forwarding unit": the kind of media server LiveKit is. Needed for >2 people. | Group calls |
| **Socket.io** | A live two-way connection between app and server. Used for call states ("ringing, accepted") and chat. | Calls, chat |
| **Push notification** | A message from Apple/Google that wakes the phone when the app is closed. | Incoming calls, chat |
| **PushKit + CallKit (iOS)** | Apple's special push that must show the native call screen immediately. Only works on real devices. | Incoming calls (Phase 5) |
| **ConnectionService / full-screen notification (Android)** | Android's native call screen. | Incoming calls (Phase 5) |
| **JWT access + refresh token** | Short-lived pass (15 min) plus a longer one to get new passes. We rotate the refresh token on every use. | Login |
| **Prisma** | Tool that defines the database tables in code and creates them (migrations). | Backend |
| **Guard (NestJS)** | A check that runs before an endpoint: logged in? right role? banned? | Backend |
| **Idempotent** | Doing the same request twice has the same result as once. Needed so retries never duplicate messages or charges. | Webhooks, chat |
| **RevenueCat** | Service that handles App Store / Google Play purchases and tells our server the result by webhook. | Subscriptions |
| **pg-boss** | A job queue stored in Postgres. Runs "transcribe then summarise" in the background with retries. | AI summary |

---

## Part C. Step-by-step plan

Order: foundation, then 1-to-1 calls working in the foreground, then group calls, then the hard native part (killed-app ringing),
then subscriptions, chat, AI, admin, release. Each phase ends with a gate. Do not start the next phase before the gate passes.

### Phase 0. Setup and clean-up

**0.1 One repository for everything** `[2-DAY]`
- What: today only `mobile/` is a git repo and `backend/`, `admin/` are empty. The plan wants one monorepo.
- How: decide with the team, then run `git init` in the project root, add a root `.gitignore` and `README.md`. The existing `mobile/.git` has a single "Initial commit"; remove it (or keep its history with a subtree move) so there is not a repo inside a repo.
- Learn: monorepo = one repository, several folders (`mobile`, `backend`, `admin`).
- Done when: `git status` at the root shows all three folders.

**0.2 Fix the mobile dependencies** `[2-DAY]`
- What: `mobile/package.json` has plain `react-native-webrtc`, which conflicts with LiveKit. It is missing LiveKit, navigation and Sentry.
- How: remove `react-native-webrtc`; add `livekit-client`, `@livekit/react-native`, `@livekit/react-native-webrtc`, `@react-navigation/native` (+ bottom-tabs, native-stack, `react-native-screens`), `@sentry/react-native`. Remove `react-native-mmkv` unless you keep it for non-sensitive flags. Then `cd ios && pod install`.
- Learn: two WebRTC native modules in one app cause build or runtime errors, so keep only the LiveKit one.
- Done when: app still builds and launches on both platforms (shows "Coach Connect").

**0.3 Local database with Docker** `[2-DAY]`
- What: a Postgres you can break freely, with no accounts needed.
- How: `docker-compose.yml` in the root with a `postgres:16` service, port 5432, a named volume.
- Done when: `psql` or a DB tool connects.

**0.4 Scaffold the NestJS backend** `[2-DAY]`
- What: empty NestJS app with `/health`.
- How: `npx @nestjs/cli new backend` (or scaffold inside the existing folder), add `@nestjs/config`, `prisma`, `@prisma/client`, `class-validator`. Add `.env.example` with `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`. Never commit real `.env`.
- Learn: NestJS organises code in modules (one folder per feature) with controllers (endpoints) and services (logic).
- Done when: `GET /health` returns ok from your phone/simulator via your Mac's IP.

**0.5 Accounts: only what you need now** `[2-DAY]`
- Now: LiveKit Cloud (free) for the media server. That is all for the 2-day slice.
- Later: Apple Developer + Google Play (Phase 5/10), Firebase (push), RevenueCat (Phase 6), Cloudflare R2 (chat images), Deepgram + Anthropic (Phase 8), Sentry, Render.

**0.6 Next.js admin scaffold**: postpone until Phase 9 (empty folder is fine for now).

**Gate 0:** app launches, backend answers `/health`, database runs, all in one repo.

**What actually happened in Phase 0 (notes from the build):**
- 0.1 Done. Root repo created on branch `main`. The old `mobile/.git` (one "Initial commit") was moved aside, not deleted. Nothing is committed yet.
- 0.2 Done. Removed `react-native-webrtc` and `react-native-mmkv`; added LiveKit, React Navigation, Sentry, op-sqlite. **Two iOS fixes were needed:** run `pod install` with `LANG=en_US.UTF-8` (CocoaPods crashes otherwise), and the Podfile now links pods as **dynamic frameworks** because React Native Firebase v27 requires it. That broke `react-native-image-picker` (missing Apple UTType frameworks), so the Podfile `post_install` links them for that one pod. The iOS simulator build now succeeds. Android was not rebuilt.
- 0.3 Partly done. `docker-compose.yml` is written, but **Docker is not installed on this Mac**, so no database is running yet. Needed before Phase 1.1.
- 0.4 Done. Nest scaffold is **Nest 12** (ESM + **Vitest** for tests, not Jest, `oxlint` for lint). Installed with `--legacy-peer-deps` because the template has a peer conflict. `GET /health` works. Prisma is added in step 1.1, when it is first used.

---

### Phase 1. Backend foundation: users, roles, login, People list

**1.1 Prisma schema v1** `[2-DAY]`
- What: tables `users`, `sessions`, `coach_profiles`, `blocks`, `subscriptions` (see A6).
- How: write `schema.prisma` with `Role` enum `MEMBER | COACH | SUPPORT | ADMIN`; `npx prisma migrate dev --name init`.
- Learn: a migration is a saved, replayable change to the database structure.
- Done when: tables exist; Prisma Studio (`npx prisma studio`) shows them.

**1.2 Email register and login** `[2-DAY]`
- What: `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`.
- How: hash passwords with `argon2`; issue 15-min access JWT; refresh token stored **hashed** in `sessions` with a device id; rotate on every refresh; reuse of an old refresh token revokes that session. Rate-limit these routes with `@nestjs/throttler`.
- Done when: register, login, refresh and logout all work from a REST client.
- Later (Phase 1b, not 2-day): Google and Apple sign-in, email verification, password reset (needs an HTTP email API, see .docx section 10).

**1.3 Guards** `[2-DAY]`
- What: `JwtAuthGuard` (who are you), `RolesGuard` (are you allowed), `BanGuard` (are you banned; checks the database, not the token).
- How: NestJS guards + a `@Roles()` decorator. Cache the ban flag for a few seconds, not for the token's life.
- Done when: a banned test user gets 403 immediately even with a valid token.

**1.4 People API** `[2-DAY]`
- What: backs screen `07 People`.
- How: `GET /people?kind=coaches|members&q=&specialty=&available=&cursor=`. Returns only: id, name, initials/avatar, role, online, specialty/availability (coaches). Excludes yourself, banned users, and anyone with a block in either direction (D9). Paginated.
- Done when: coaches tab and members tab return the right people; search works.

**1.5 Seed data** `[2-DAY]`
- What: 3 coaches, 8 members, 1 admin, so you can test group calls without making accounts by hand.
- How: `prisma/seed.ts`, run with `npx prisma db seed`. Give members an `ACTIVE` subscription row so the call gate passes in dev.
- Done when: fresh database fills with one command.

**Gate 1:** from a REST client: register, login, list coaches, list members, ban a user and watch them get blocked.

---

### Phase 2. Mobile shell: login, People, profile

**2.1 Navigation skeleton** `[2-DAY]`
- What: bottom tabs **People / Messages / Calls / Profile** (screens `07`, `09`, `15`, `17`). Coaches see **Today** (`11`) too, shown only when role is COACH.
- How: React Navigation: auth stack (Splash, Sign in, Create account) and main tabs. Empty placeholder screens first.
- Done when: you can move between tabs and between auth and main.

**2.2 API client and secure tokens** `[2-DAY]`
- What: one place that calls the backend and refreshes expired tokens.
- How: `fetch` wrapper; store tokens in Keychain/Keystore via `react-native-keychain`; on `401` try refresh once, else go to login. TanStack Query for loading/caching lists.
- Learn: never put tokens in plain storage like AsyncStorage or MMKV.
- Done when: kill and reopen the app and you are still logged in (PRD acceptance); expired session returns to login without a crash.

**2.3 Sign in / Create account screens** `[2-DAY]`
- Build from UI `02`, `03`. Email and password only for now.

**2.4 People screen** `[2-DAY]`
- What: UI `07`: two segments **Coaches (n)** and **Members (n)**, search, specialty filter and "Available now" for coaches, subtitle "Calls between members are one-to-one. When you call a coach, you can bring up to 4 members into the call."
- How: two queries to `/people` by `kind`; row tap opens profile (coach) or a small member sheet with **Message** and **Call**.
- Done when: both lists load from the real backend with search.

**2.5 Coach profile** `[2-DAY]`: UI `08` with Call / Video / Chat buttons wired to placeholders.

**2.6 Trial banner and paywall stub**: UI `06`. Show the "Trial 6 days left" chip from the `subscriptions` row. Real purchases come in Phase 6.

**Gate 2:** log in on a device, see real coaches and members from the backend.

---

### Phase 3. One-to-one calls (app open, no native ringing yet)

Strategy: get audio/video working between two phones **with the app open** first. The killed-app ringing (Phase 5) is the hardest native work, so we do not mix the two.

**3.1 Call tables** `[2-DAY]`
- Add `calls` and `call_participants` with the extra fields from A6; migrate.

**3.2 Pure rules module with unit tests** `[2-DAY]`
- What: a plain TypeScript file `call-rules.ts` with functions like `canStartCall(caller, callee)`, `canInvite(call, host, invitee)`, `seatsLeft(call)`. No database inside; you pass data in.
- How: write the tests first (Jest): coach cannot be invited; member-to-member cannot invite; 5th guest refused; blocked refused.
- Learn: keeping rules separate from the database makes them easy to test and impossible to forget in one endpoint.
- Done when: `npm test` passes with every rule from A4.

**3.3 LiveKit helper** `[2-DAY]`
- How: `livekit-server-sdk`: `RoomServiceClient.createRoom({ name, maxParticipants: 6 })` and `AccessToken` with a grant for **one room, one identity**, expiring in minutes.
- Learn: the API secret stays in `.env` on the server; the app only ever receives a token.

**3.4 Start, accept, decline, cancel** `[2-DAY]`
- What: `POST /calls` and Socket.io events on a `/calls` namespace.
- How (server owns the state machine; the app only sends intents):
  `RINGING` then accept leads to `ACTIVE`; otherwise a final state: `DECLINED`, `BUSY`, `CANCELED`, `MISSED` (30 s timeout), `FAILED`, `COMPLETED`.
  On create: run the A4 checks, create call + participants, create the room, emit `call.incoming` to the callee's socket. On accept: return a join token.
- Done when: two devices, one calls, other accepts, both get tokens.

**3.5 Mobile call screens** `[2-DAY]`
- Build: `12 Calling` (ringing, 30 s timeout, Cancel), in-app incoming call card (temporary, replaced by native UI in Phase 5), `13 Coach call` and `14 Video call` controls: mute, speaker, camera, flip, end.
- How: `@livekit/react-native`: `registerGlobals()` once at startup, `LiveKitRoom` / `useRoomContext`, `useTracks`, publish mic/camera. Permissions: microphone, camera.
- Done when: two phones talk to each other with audio, then video.

**3.6 Server-side call log** `[2-DAY]`
- What: duration and final status are written by the **server** when the room closes, never from phone timers.
- How: LiveKit webhook (`room_finished`, `participant_joined/left`) hits `POST /livekit/webhook`; verify its signature; update `call_participants` and `calls.duration_s`. This works for 1:1 and later group calls without changes.
- Done when: Calls tab (`15`) shows the right outcome (completed, missed, declined) and minutes.

**3.7 Reconnect behaviour**: test Wi-Fi to mobile data. LiveKit reconnects by itself; show a "Reconnecting…" banner; after 15 s without media end as `FAILED`.

**Gate 3:** call between a member and a coach, audio + video, correct log, survives a 10 s network drop. Member-to-member 1:1 works too.

---

### Phase 4. Coach group calls (the new feature)

Everything here builds on Phase 3. If Phase 3 works, this is mostly extra rows and two screens.

**4.1 Presence ("Members online")** `[2-DAY]`
- What: UI `13b` lists members who are online now.
- How: track connected sockets in memory (single server instance); `GET /people/online?kind=members` joins that with the database and applies the A4 filters (subscribed, not busy, not blocked, not banned).
- Learn: "online" is just "has an open socket". With more than one server you would need Redis; not now.

**4.2 Invite endpoint** `[2-DAY]`
- What: `POST /calls/:id/invite { userIds: [..] }`.
- How: inside one transaction: lock the call row (`SELECT … FOR UPDATE`), run `canInvite` for every id, count seats, insert `call_participants` as `INVITED` then `RINGING`, emit `call.incoming` to each invitee. Return per-user results (some can succeed while others fail).
- Learn: the row lock is what stops two simultaneous requests from both thinking a seat is free.
- Done when: unit + integration tests cover: 4 ok, 5th refused, coach refused, member-to-member call refused, non-host refused, blocked refused, unsubscribed refused.

**4.3 Invitee flow** `[2-DAY]`
- Accept: only then does the server mint a token for that person for that room, and re-checks subscription and ban at that moment. Decline or 30 s timeout: state becomes `DECLINED` or `MISSED`, seat is freed, host is told.

**4.4 Participant events** `[2-DAY]`
- Server pushes `participant.updated` (invited, ringing, joined, declined, left) so the group screen shows "Ringing…", "Joined", "Declined" live. The call's `seats used / 4` counter comes from the same data.

**4.5 Mobile: Add members screen** `[2-DAY]`
- Build UI `13b`: header "In call with Amara · 04:12", chips for You / Coach / selected members, search, **Members online (n)** list with checkbox, **Coaches** section explaining "Only one coach per call", button text "Choose up to 4 members" that becomes "Add 2 people" etc.
- How: bottom sheet over the active call; selection capped at `4 - seatsInUse`; call `invite`; close on result.
- Done when: you cannot even select a 5th person; and if the server still refuses, you see a clear message.

**4.6 Mobile: Group call screen** `[2-DAY]`
- Build UI `13c`: participant grid with name + state, Coach tag, Add button that turns into **Full** at 6, Leave button, recording line ("4 agreed. People still joining will be asked.").
- How: `useParticipants()` from LiveKit for video/audio; merge with `participant.updated` for people still ringing (they are not in the room yet).

**4.7 Leave and end rules** (D5)
- Anyone may Leave. Coach leaving (after the 15 s rejoin window) or fewer than 2 people left ends the call for everyone; server closes the room and writes the log.

**4.8 Hard cases to test by hand** (write these as a checklist and tick each):
- Host taps Add on two phones at the same time. Invitee is on another call (BUSY). Invitee is on a locked phone (works fully only after Phase 5). Host loses network then returns. Guest gets banned during the call (removed from the room within seconds). Coach declines recording while others accept. Someone joins late and is asked to consent.

**Gate 4:** 1 host + 1 coach + 4 members on real devices; 5th attempt refused; log shows 6 participants with the right states.

---

### Phase 5. Incoming calls when the app is killed or the phone is locked

This is the hardest part of the project and must run on **real devices** (PushKit does not work on the iOS simulator). Do a spike first and do not postpone it.

**5.1 Spike (1 day):** minimum app that rings from a push on one iOS and one Android phone with the app killed. Decide only after this whether the estimate holds.
**5.2 iOS:** APNs VoIP key in Apple Developer; `react-native-voip-push-notification` + `react-native-callkeep` in `AppDelegate`. Rule: when a VoIP push arrives you **must** show CallKit at once or iOS will stop delivering pushes to the app.
**5.3 Android:** FCM high-priority data message, then `ConnectionService` (via CallKeep) or a full-screen-intent notification; declare the permissions in the manifest; handle Do Not Disturb and battery saver.
**5.4 Cold-start accept:** app starts from killed, reads tokens from Keychain, refreshes if needed, requests the join token, connects the room.
**5.5 Multi-device and cancel:** all of a user's devices ring; accepting on one stops the others; caller hanging up stops the ring.
**5.6 Missed call:** notification + entry in Calls tab.
**5.7 Group tie-in:** invitees added mid-call use this same path, so test "added to a call while phone locked".

**Gate 5 (PRD acceptance):** a call rings on a locked, killed phone on iOS and Android and connects when accepted.

---

### Phase 6. Subscriptions (RevenueCat)

- 6.1 Products (monthly, yearly) in App Store Connect / Play Console; RevenueCat project, entitlement `premium`. Needs the paid developer accounts.
- 6.2 App: `Purchases.configure`, `Purchases.logIn(userId)`, paywall (`06`), restore purchases (`17`).
- 6.3 Backend webhook: verify auth header, **deduplicate by event id**, then **re-fetch the subscriber from RevenueCat's REST API** and store status (`ACTIVE | TRIAL | GRACE_PERIOD | CANCELLED_ACTIVE | EXPIRED`). The webhook is only a trigger, never the truth (events arrive twice or out of order).
- 6.4 Replace the dev stub with the real check in `POST /calls`, in invite, and at token mint.
- 6.5 Mid-call expiry: do not cut the call; block the next call.
- **Gate 6:** sandbox purchase unlocks calling; an expired user is refused even with a modified app.

### Phase 7. Chat

- 7.1 Tables `conversations`, `messages` (unique `(sender_id, client_msg_id)`, sequence number). Any two users can chat (R1).
- 7.2 Socket.io `/chat`: save, then ack; duplicate sends return the original ack.
- 7.3 Mobile SQLite outbox (`op-sqlite`), connection banner (UI `10`), catch-up with `since_seq`.
- 7.4 Receipts, typing, image upload via R2 presigned URL, push when recipient is offline (FCM / APNs).
- **Gate 7:** 200 messages sent offline arrive once and in order.

### Phase 8. Recording consent and AI summary (group-aware)

- 8.1 Consent: each participant has `consent` (UNKNOWN/YES/NO) in `call_participants`; recording of a person's track starts only when **everyone currently in the call** has said yes; a late joiner triggers the prompt again (UI `13`, `13c`).
- 8.2 Record **one audio track per person**; never merge (exact speaker names, so action items go to the right person).
- 8.3 After the call, a pg-boss job transcribes each track, merges by timestamp, sends the transcript to Claude with a fixed JSON schema (summary, topics, action items per person), retries once, else `FAILED` (UI shows a clear message and the backend retries).
- 8.4 Apply D4: only calls with a coach get summaries. Apply A5 cost controls (skip silence).
- 8.5 Show summary (`16`), action items; delete raw audio after transcription.
- **Gate 8:** 20 test calls (include 3 group calls) produce correct, correctly attributed summaries.

### Phase 9. Admin panel (not updated in the UI yet)

Build the screens as designed (`A1`-`A7`) first. Because Phase 3/4 already store participants and states, the later group-call update is only display work:
- Call logs: show a participant count and a **Group** badge; the drawer lists every participant with their state and consent.
- User detail > Recent calls: "Coach" column becomes **With** (can be a coach, a member, or "Amara +4").
- Users & coaches table already lists both roles. A dedicated Coaches management view is to be designed later.
- Backend roles are enforced on every admin API (Support = read only), ban kills sockets, tokens and live rooms within 5 s.

### Phase 10. Release

Signing, dev/staging/prod configs, Sentry in app and backend, GitHub Actions (backend on Linux, Android build to Play internal testing, iOS built in Xcode to TestFlight), soak test (4 h of calls, 50 chat users), self-hosted LiveKit on a VM, privacy policy, account deletion, report/block.

---

## Part D. The 2-day slice (honest scope)

The full plan is about 12 weeks for one developer. In 2 days you can show a **working vertical slice**, and the steps marked `[2-DAY]` are that slice. Suggested split:

**Day 1: foundation and People**
0.1 to 0.5, then 1.1 to 1.5, then 2.1 to 2.5.
End of day: log in on a phone, see seeded coaches and members from the real backend.

**Day 2: calls and groups**
3.1 to 3.6, then 4.1 to 4.6.
End of day: member calls coach, adds up to 4 members, all talk with the app open; call log recorded.

**Not in 2 days (tell the client up front):** killed or locked phone ringing (Phase 5), real purchases (6), chat (7), AI summaries (8), admin panel (9), store release (10). In the demo you can show their UI screens as designs and the dev subscription switch as a stand-in.

If Day 2 runs short, cut in this order: 4.7 (end rules) and 3.7 (reconnect), then video (keep audio), then the Add-members search box. Never cut 3.2 (rules with tests): it is what proves the "6 people, 1 coach" rule.

---

## Part E. Screen to backend map (quick reference)

| UI screen | Needs |
|-----------|-------|
| 07 People | `GET /people` (coaches / members), search, filters |
| 08 Coach profile | `GET /coaches/:id`, start call / chat |
| 12 Calling | `POST /calls`, `call.*` socket events, 30 s timeout |
| 13 Coach call + consent | LiveKit room, consent events |
| 13b Add members | `GET /people/online`, `POST /calls/:id/invite` |
| 13c Group coach call | LiveKit participants + `participant.updated` events |
| 15 Call history | `GET /calls` (per user) |
| 16 Call summary | `GET /calls/:id/summary` (Phase 8) |
| 09 / 10 Messages, Chat | `/chat` namespace (Phase 7) |
| 06 Paywall, 17 Settings | RevenueCat + `GET /me/subscription` |
| 11 Coach mode Today | `GET /coach/today`, availability toggle |
| A1-A7 Admin | Phase 9 |
