-- CreateEnum
CREATE TYPE "OneTimeCodePurpose" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET');

-- CreateTable
CREATE TABLE "one_time_codes" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "purpose" "OneTimeCodePurpose" NOT NULL,
    "code_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "one_time_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "one_time_codes_user_id_idx" ON "one_time_codes"("user_id");

-- AddForeignKey
ALTER TABLE "one_time_codes" ADD CONSTRAINT "one_time_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════════════
-- RAW SQL
-- ═══════════════════════════════════════════════════════════════════════

-- At most ONE active (not yet used/replaced) code per user and purpose.
-- Why: "send me a new code" first marks the old one consumed; if two requests race,
-- the database refuses the second insert instead of leaving two valid codes around.
CREATE UNIQUE INDEX "one_time_codes_active_key" ON "one_time_codes" ("user_id", "purpose") WHERE "consumed_at" IS NULL;

ALTER TABLE "one_time_codes" ADD CONSTRAINT "one_time_codes_attempts_chk" CHECK ("attempts" >= 0);
