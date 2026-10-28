-- Naming cleanup (no data is touched; RENAME keeps every row, index and constraint).
-- Conventions: snake_case; plural table names; booleans start with is_; timestamps end in _at;
-- no abbreviations (seq, msg, prev, attempts -> failed_attempts); enum types in snake_case.

-- ── Enum types: PascalCase -> snake_case ──
ALTER TYPE "Role" RENAME TO "user_role";
ALTER TYPE "SessionAudience" RENAME TO "session_audience";
ALTER TYPE "SessionRevokeReason" RENAME TO "session_revoke_reason";
ALTER TYPE "SubscriptionStatus" RENAME TO "subscription_status";
ALTER TYPE "OneTimeCodePurpose" RENAME TO "one_time_code_purpose";

-- ── sessions: say what the hashes are hashes OF ──
ALTER TABLE "sessions" RENAME COLUMN "refresh_hash" TO "refresh_token_hash";
ALTER TABLE "sessions" RENAME COLUMN "prev_refresh_hash" TO "previous_refresh_token_hash";

-- ── coach_profiles: booleans start with is_ ──
ALTER TABLE "coach_profiles" RENAME COLUMN "approved" TO "is_approved";
ALTER TABLE "coach_profiles" RENAME COLUMN "available" TO "is_available";

-- ── subscriptions: it is the billing plan, not a store product id ──
ALTER TABLE "subscriptions" RENAME COLUMN "product" TO "plan";

-- ── one_time_codes: what is counted ──
ALTER TABLE "one_time_codes" RENAME COLUMN "attempts" TO "failed_attempts";
ALTER TABLE "one_time_codes" RENAME CONSTRAINT "one_time_codes_attempts_chk" TO "one_time_codes_failed_attempts_chk";

-- ── blocks -> user_blocks (a bare "blocks" says nothing) ──
ALTER TABLE "blocks" RENAME TO "user_blocks";
ALTER INDEX "blocks_pkey" RENAME TO "user_blocks_pkey";
ALTER INDEX "blocks_blocked_id_idx" RENAME TO "user_blocks_blocked_id_idx";
ALTER TABLE "user_blocks" RENAME CONSTRAINT "blocks_blocker_id_fkey" TO "user_blocks_blocker_id_fkey";
ALTER TABLE "user_blocks" RENAME CONSTRAINT "blocks_blocked_id_fkey" TO "user_blocks_blocked_id_fkey";
ALTER TABLE "user_blocks" RENAME CONSTRAINT "blocks_not_self_chk" TO "user_blocks_not_self_chk";

-- ── audit_log -> audit_logs (every other table is plural) ──
ALTER TABLE "audit_log" RENAME TO "audit_logs";
ALTER INDEX "audit_log_pkey" RENAME TO "audit_logs_pkey";
ALTER INDEX "audit_log_actor_id_created_at_idx" RENAME TO "audit_logs_actor_id_created_at_idx";
ALTER INDEX "audit_log_target_type_target_id_created_at_idx" RENAME TO "audit_logs_target_type_target_id_created_at_idx";
ALTER INDEX "audit_log_created_at_idx" RENAME TO "audit_logs_created_at_idx";

-- ── conversations: spell out what the counters are ──
ALTER TABLE "conversations" RENAME COLUMN "last_seq" TO "last_message_seq";
ALTER TABLE "conversations" RENAME COLUMN "a_read_seq" TO "user_a_last_read_seq";
ALTER TABLE "conversations" RENAME COLUMN "b_read_seq" TO "user_b_last_read_seq";

-- ── messages: no abbreviations ──
ALTER TABLE "messages" RENAME COLUMN "seq" TO "sequence_number";
ALTER TABLE "messages" RENAME COLUMN "client_msg_id" TO "client_message_id";
ALTER INDEX "messages_sender_id_client_msg_id_key" RENAME TO "messages_sender_id_client_message_id_key";
ALTER INDEX "messages_conversation_id_seq_key" RENAME TO "messages_conversation_id_sequence_number_key";
ALTER TABLE "messages" RENAME CONSTRAINT "messages_seq_positive_check" TO "messages_sequence_number_positive_check";
