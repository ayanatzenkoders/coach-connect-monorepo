-- CreateTable
CREATE TABLE "conversations" (
    "id" UUID NOT NULL,
    "user_a_id" UUID NOT NULL,
    "user_b_id" UUID NOT NULL,
    "last_seq" INTEGER NOT NULL DEFAULT 0,
    "a_read_seq" INTEGER NOT NULL DEFAULT 0,
    "b_read_seq" INTEGER NOT NULL DEFAULT 0,
    "last_message_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "client_msg_id" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "conversations_user_a_id_last_message_at_idx" ON "conversations"("user_a_id", "last_message_at" DESC);

-- CreateIndex
CREATE INDEX "conversations_user_b_id_last_message_at_idx" ON "conversations"("user_b_id", "last_message_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "conversations_user_a_id_user_b_id_key" ON "conversations"("user_a_id", "user_b_id");

-- CreateIndex
CREATE UNIQUE INDEX "messages_sender_id_client_msg_id_key" ON "messages"("sender_id", "client_msg_id");

-- CreateIndex
CREATE UNIQUE INDEX "messages_conversation_id_seq_key" ON "messages"("conversation_id", "seq");

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_a_id_fkey" FOREIGN KEY ("user_a_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_b_id_fkey" FOREIGN KEY ("user_b_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RAW: the pair is always stored with the smaller id first. Together with the unique index this
-- guarantees ONE conversation per pair of people, and it also forbids chatting with yourself.
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_pair_order_check" CHECK ("user_a_id" < "user_b_id");

-- RAW: message numbers start at 1; a message is never empty and never huge.
ALTER TABLE "messages" ADD CONSTRAINT "messages_seq_positive_check" CHECK ("seq" >= 1);
ALTER TABLE "messages" ADD CONSTRAINT "messages_body_length_check" CHECK (char_length("body") BETWEEN 1 AND 2000);
