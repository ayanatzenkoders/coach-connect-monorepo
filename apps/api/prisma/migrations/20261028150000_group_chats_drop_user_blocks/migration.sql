-- 1. Groups: a description, and who created the group.
ALTER TABLE "chats"
  ADD COLUMN "description" TEXT,
  ADD COLUMN "created_by_id" UUID;

ALTER TABLE "chats" ADD CONSTRAINT "chats_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RAW: a group always has a name of 1 to 60 characters; the description is optional and short.
-- (The "one coach per group" and "3 to 6 people" rules are checked by the API when the group is created:
--  members cannot change afterwards yet. When adding members later is built, enforce them in the same transaction.)
ALTER TABLE "chats" ADD CONSTRAINT "chats_group_title_check" CHECK ("type" = 'DIRECT' OR ("title" IS NOT NULL AND char_length("title") BETWEEN 1 AND 60));
ALTER TABLE "chats" ADD CONSTRAINT "chats_description_length_check" CHECK ("description" IS NULL OR char_length("description") <= 300);

-- 2. Users blocking users is removed (nothing could create a block, and the app does not offer it).
--    Banning is the only way an account is cut off, and it is an admin decision.
DROP TABLE "user_blocks";
