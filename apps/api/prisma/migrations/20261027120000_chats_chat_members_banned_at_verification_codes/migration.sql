-- Three schema changes in one migration. Every statement keeps existing rows.
--   1. conversations (user_a/user_b + two read counters) -> chats + chat_members (one row per user per chat)
--   2. users: is_banned / ban_reason / banned_by_id dropped; banned_at alone says "banned"
--   3. one_time_codes -> verification_codes

-- ═════════════ 1. Chats ═════════════

CREATE TYPE "chat_type" AS ENUM ('DIRECT', 'GROUP');

ALTER TABLE "conversations" RENAME TO "chats";
ALTER INDEX "conversations_pkey" RENAME TO "chats_pkey";
ALTER TABLE "chats" RENAME COLUMN "last_message_seq" TO "last_message_sequence_number";

ALTER TABLE "chats"
  ADD COLUMN "type" "chat_type" NOT NULL DEFAULT 'DIRECT',
  ADD COLUMN "direct_key" TEXT,
  ADD COLUMN "title" TEXT,
  ADD COLUMN "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "chats" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "chats" ALTER COLUMN "updated_at" DROP DEFAULT;

-- Every existing chat is a one-to-one chat. The key is the two ids, smaller first
-- (the old user_a_id < user_b_id rule), so the same pair always gives the same key.
UPDATE "chats" SET "direct_key" = "user_a_id"::text || ':' || "user_b_id"::text;

-- chat_members: the junction between users and chats. It also holds each person's read position.
CREATE TABLE "chat_members" (
    "chat_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "last_read_sequence_number" INTEGER NOT NULL DEFAULT 0,
    "joined_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_members_pkey" PRIMARY KEY ("chat_id", "user_id")
);

-- Two members per existing chat, keeping each side's read position.
INSERT INTO "chat_members" ("chat_id", "user_id", "last_read_sequence_number", "joined_at")
SELECT "id", "user_a_id", "user_a_last_read_seq", "created_at" FROM "chats"
UNION ALL
SELECT "id", "user_b_id", "user_b_last_read_seq", "created_at" FROM "chats";

-- Dropping the columns also drops their foreign keys, indexes, the unique pair and the pair-order CHECK.
ALTER TABLE "chats"
  DROP COLUMN "user_a_id",
  DROP COLUMN "user_b_id",
  DROP COLUMN "user_a_last_read_seq",
  DROP COLUMN "user_b_last_read_seq";

CREATE UNIQUE INDEX "chats_direct_key_key" ON "chats"("direct_key");
CREATE INDEX "chat_members_user_id_idx" ON "chat_members"("user_id"); -- "my chats"

ALTER TABLE "chat_members" ADD CONSTRAINT "chat_members_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chat_members" ADD CONSTRAINT "chat_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RAW: a direct chat has a key (that is what stops a second chat for the same pair); a group has none.
ALTER TABLE "chats" ADD CONSTRAINT "chats_direct_key_check" CHECK (("type" = 'DIRECT') = ("direct_key" IS NOT NULL));
ALTER TABLE "chats" ADD CONSTRAINT "chats_last_message_sequence_number_check" CHECK ("last_message_sequence_number" >= 0);
-- RAW: nobody has read more messages than exist is enforced by the service (it caps at the newest number).
ALTER TABLE "chat_members" ADD CONSTRAINT "chat_members_last_read_sequence_number_check" CHECK ("last_read_sequence_number" >= 0);

-- messages: conversation_id -> chat_id
ALTER TABLE "messages" RENAME COLUMN "conversation_id" TO "chat_id";
ALTER TABLE "messages" RENAME CONSTRAINT "messages_conversation_id_fkey" TO "messages_chat_id_fkey";
ALTER INDEX "messages_conversation_id_sequence_number_key" RENAME TO "messages_chat_id_sequence_number_key";

-- ═════════════ 2. Bans: banned_at is the only column ═════════════
-- "Who banned and why" lives in audit_logs (written on every ban). Old rows: is_banned implied banned_at (CHECK).

DROP INDEX "users_banned_idx";
ALTER TABLE "users" DROP CONSTRAINT "users_ban_consistent_chk";
UPDATE "users" SET "banned_at" = NULL WHERE NOT "is_banned";
ALTER TABLE "users"
  DROP COLUMN "is_banned",
  DROP COLUMN "ban_reason",
  DROP COLUMN "banned_by_id";
-- Admin "banned users" list. Only a handful of users are banned, so this index stays tiny.
CREATE INDEX "users_banned_idx" ON "users" ("banned_at" DESC) WHERE "banned_at" IS NOT NULL;

-- ═════════════ 3. one_time_codes -> verification_codes ═════════════

ALTER TYPE "one_time_code_purpose" RENAME TO "verification_code_purpose";
ALTER TABLE "one_time_codes" RENAME TO "verification_codes";
ALTER INDEX "one_time_codes_pkey" RENAME TO "verification_codes_pkey";
ALTER INDEX "one_time_codes_user_id_idx" RENAME TO "verification_codes_user_id_idx";
ALTER INDEX "one_time_codes_active_key" RENAME TO "verification_codes_active_key";
ALTER TABLE "verification_codes" RENAME CONSTRAINT "one_time_codes_user_id_fkey" TO "verification_codes_user_id_fkey";
ALTER TABLE "verification_codes" RENAME CONSTRAINT "one_time_codes_failed_attempts_chk" TO "verification_codes_failed_attempts_chk";
