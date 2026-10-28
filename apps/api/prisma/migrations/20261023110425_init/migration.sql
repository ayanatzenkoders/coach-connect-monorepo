-- CreateEnum
CREATE TYPE "Role" AS ENUM ('MEMBER', 'COACH', 'SUPPORT', 'ADMIN');

-- CreateEnum
CREATE TYPE "SessionAudience" AS ENUM ('MOBILE', 'ADMIN');

-- CreateEnum
CREATE TYPE "SessionRevokeReason" AS ENUM ('LOGOUT', 'REPLACED', 'REUSE_DETECTED', 'BANNED', 'ADMIN_REVOKED', 'PASSWORD_CHANGED');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'GRACE_PERIOD', 'CANCELLED_ACTIVE', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SubscriptionSource" AS ENUM ('REVENUECAT', 'ADMIN_OVERRIDE');

-- CreateEnum
CREATE TYPE "PushPlatform" AS ENUM ('IOS_VOIP', 'IOS_APNS', 'ANDROID_FCM');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'MEMBER',
    "is_banned" BOOLEAN NOT NULL DEFAULT false,
    "banned_at" TIMESTAMPTZ(3),
    "ban_reason" TEXT,
    "banned_by_id" UUID,
    "email_verified_at" TIMESTAMPTZ(3),
    "deleted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "audience" "SessionAudience" NOT NULL,
    "device_id" TEXT NOT NULL,
    "device_name" TEXT,
    "refresh_hash" TEXT NOT NULL,
    "prev_refresh_hash" TEXT,
    "rotated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "revoked_reason" "SessionRevokeReason",

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coach_profiles" (
    "user_id" UUID NOT NULL,
    "bio" TEXT NOT NULL DEFAULT '',
    "specialties" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "available" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "coach_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "SubscriptionStatus" NOT NULL,
    "source" "SubscriptionSource" NOT NULL DEFAULT 'REVENUECAT',
    "product" TEXT,
    "expires_at" TIMESTAMPTZ(3),
    "last_event_id" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blocks" (
    "blocker_id" UUID NOT NULL,
    "blocked_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blocks_pkey" PRIMARY KEY ("blocker_id","blocked_id")
);

-- CreateTable
CREATE TABLE "push_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "platform" "PushPlatform" NOT NULL,
    "token" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL,
    "actor_id" UUID,
    "action" TEXT NOT NULL,
    "target_type" TEXT,
    "target_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "coach_profiles_specialties_idx" ON "coach_profiles" USING GIN ("specialties");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_user_id_key" ON "subscriptions"("user_id");

-- CreateIndex
CREATE INDEX "blocks_blocked_id_idx" ON "blocks"("blocked_id");

-- CreateIndex
CREATE UNIQUE INDEX "push_tokens_token_key" ON "push_tokens"("token");

-- CreateIndex
CREATE INDEX "push_tokens_user_id_idx" ON "push_tokens"("user_id");

-- CreateIndex
CREATE INDEX "audit_log_actor_id_created_at_idx" ON "audit_log"("actor_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_log_target_type_target_id_created_at_idx" ON "audit_log"("target_type", "target_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_log_created_at_idx" ON "audit_log"("created_at");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_profiles" ADD CONSTRAINT "coach_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocker_id_fkey" FOREIGN KEY ("blocker_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocked_id_fkey" FOREIGN KEY ("blocked_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════════════
-- RAW SQL: things Prisma's schema language cannot express.
-- Each block says WHAT it protects/speeds up and WHY.
-- ═══════════════════════════════════════════════════════════════════════

-- ── CHECK constraints: the database refuses bad data even if app code has a bug ──

-- Emails are stored lowercase, so "Ana@x.com" and "ana@x.com" can never be two accounts.
ALTER TABLE "users" ADD CONSTRAINT "users_email_lowercase_chk" CHECK ("email" = lower("email"));

-- A banned user must always have a ban time (no half-banned rows).
ALTER TABLE "users" ADD CONSTRAINT "users_ban_consistent_chk" CHECK (NOT "is_banned" OR "banned_at" IS NOT NULL);

-- Nobody can block themselves.
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_not_self_chk" CHECK ("blocker_id" <> "blocked_id");

-- ── PARTIAL UNIQUE indexes: uniqueness that only applies to a subset of rows ──

-- One account per email, but only among accounts that are NOT deleted.
-- Why: after a user deletes their account, the same email can sign up again.
CREATE UNIQUE INDEX "users_email_active_key" ON "users" ("email") WHERE "deleted_at" IS NULL;

-- At most ONE live session per (user, device). Signing in again on the same phone
-- first revokes the old session. Revoked rows are ignored, so history is kept.
CREATE UNIQUE INDEX "sessions_user_device_live_key" ON "sessions" ("user_id", "device_id") WHERE "revoked_at" IS NULL;

-- ── PARTIAL (filtered) indexes: small indexes over just the rows we search ──

-- Admin "banned users" list. Only a handful of users are banned, so this index stays tiny
-- instead of indexing millions of normal users.
CREATE INDEX "users_banned_idx" ON "users" ("banned_at" DESC) WHERE "is_banned";

-- "Live sessions of this user" (ban, logout-all, active-devices screen). Revoked/old sessions
-- pile up forever; this index ignores them, so it stays fast as history grows.
CREATE INDEX "sessions_user_live_idx" ON "sessions" ("user_id") WHERE "revoked_at" IS NULL;

-- People screen "Available now" coaches. Few coaches are approved AND available at once.
CREATE INDEX "coach_profiles_listable_idx" ON "coach_profiles" ("user_id") WHERE "approved" AND "available";

-- Background job that finds subscriptions about to end. Expired rows (the majority over
-- time) are not indexed at all.
CREATE INDEX "subscriptions_expiring_idx" ON "subscriptions" ("expires_at")
  WHERE "status" IN ('TRIAL', 'ACTIVE', 'GRACE_PERIOD', 'CANCELLED_ACTIVE');
