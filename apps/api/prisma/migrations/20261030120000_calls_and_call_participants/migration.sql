-- Calls (voice/video) attached to a chat, and one row per person per call.
CREATE TYPE "call_state" AS ENUM ('RINGING', 'ACTIVE', 'ENDED');
CREATE TYPE "call_end_reason" AS ENUM ('COMPLETED', 'NO_ANSWER', 'DECLINED', 'CANCELED', 'BANNED');
CREATE TYPE "call_participant_status" AS ENUM ('INVITED', 'JOINED', 'DECLINED', 'MISSED', 'BUSY');

CREATE TABLE "calls" (
    "id" UUID NOT NULL,
    "chat_id" UUID NOT NULL,
    "started_by_id" UUID NOT NULL,
    "state" "call_state" NOT NULL DEFAULT 'RINGING',
    "end_reason" "call_end_reason",
    "video" BOOLEAN NOT NULL DEFAULT false,
    "room_name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answered_at" TIMESTAMPTZ(3),
    "ended_at" TIMESTAMPTZ(3),
    CONSTRAINT "calls_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "call_participants" (
    "id" UUID NOT NULL,
    "call_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "call_participant_status" NOT NULL DEFAULT 'INVITED',
    "invited_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "joined_at" TIMESTAMPTZ(3),
    "left_at" TIMESTAMPTZ(3),
    CONSTRAINT "call_participants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "calls_room_name_key" ON "calls"("room_name");
CREATE INDEX "calls_chat_idx" ON "calls"("chat_id", "created_at" DESC);
CREATE UNIQUE INDEX "call_participants_call_id_user_id_key" ON "call_participants"("call_id", "user_id");
CREATE INDEX "call_participants_user_idx" ON "call_participants"("user_id", "invited_at" DESC);

ALTER TABLE "calls" ADD CONSTRAINT "calls_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "calls" ADD CONSTRAINT "calls_started_by_id_fkey" FOREIGN KEY ("started_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "call_participants" ADD CONSTRAINT "call_participants_call_id_fkey" FOREIGN KEY ("call_id") REFERENCES "calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "call_participants" ADD CONSTRAINT "call_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RAW (hand-written, Prisma cannot express these) ----------------------------------------------------------------

-- ONE live call per chat. Two people pressing "call" at the same moment: the database lets exactly one row in.
CREATE UNIQUE INDEX "calls_one_live_per_chat" ON "calls"("chat_id") WHERE "state" IN ('RINGING', 'ACTIVE');

-- "Is this person in a call right now?" (the busy check). Only the few connected rows are indexed.
CREATE INDEX "call_participants_connected_idx" ON "call_participants"("user_id") WHERE "joined_at" IS NOT NULL AND "left_at" IS NULL;

-- The sweeper looks for old ringing calls only.
CREATE INDEX "calls_ringing_idx" ON "calls"("created_at") WHERE "state" = 'RINGING';

-- A call has an end reason and end time exactly when it is ENDED.
ALTER TABLE "calls" ADD CONSTRAINT "calls_end_check" CHECK (("state" = 'ENDED') = ("end_reason" IS NOT NULL AND "ended_at" IS NOT NULL));
-- Someone who joined has a join time; leaving needs a join first.
ALTER TABLE "call_participants" ADD CONSTRAINT "call_participants_join_check" CHECK ("status" <> 'JOINED' OR "joined_at" IS NOT NULL);
ALTER TABLE "call_participants" ADD CONSTRAINT "call_participants_left_check" CHECK ("left_at" IS NULL OR "joined_at" IS NOT NULL);
