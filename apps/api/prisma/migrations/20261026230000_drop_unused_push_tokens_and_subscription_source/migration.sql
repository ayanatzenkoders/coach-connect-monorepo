-- Cleanup of things nothing uses yet. Both come back with the features that need them:
--  - push notifications (push_tokens, and deleting a banned user's tokens)
--  - RevenueCat sync (where a subscription came from, last webhook event id)

-- DropTable
DROP TABLE "push_tokens";

-- DropEnum
DROP TYPE "PushPlatform";

-- AlterTable
ALTER TABLE "subscriptions" DROP COLUMN "source", DROP COLUMN "last_event_id";

-- DropEnum
DROP TYPE "SubscriptionSource";
