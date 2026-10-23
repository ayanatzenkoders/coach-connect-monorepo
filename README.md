# Coach Connect

Subscription app where members talk to coaches by audio/video call and chat, with AI call summaries.

| Folder | What | Stack |
|--------|------|-------|
| `mobile/` | iOS + Android app | React Native CLI (bare), TypeScript |
| `backend/` | API, realtime, jobs | NestJS, Prisma, Postgres |
| `admin/` | Web admin panel | Next.js (later phase) |
| `Requirement & Design/` | PRD, UI design, plans | docs |

Plan: `Requirement & Design/Coach Connect Detailed Plan.md`

## Local setup
1. Database: either `docker compose up -d`, or Homebrew: `brew install postgresql@16 && brew services start postgresql@16` then create role `coach` (password in `backend/.env.example`) and database `coachconnect`
2. Backend: `cd backend && cp .env.example .env && npm install && npm run start:dev`
3. Mobile: `cd mobile && npm install && cd ios && pod install && cd .. && npm run ios`
