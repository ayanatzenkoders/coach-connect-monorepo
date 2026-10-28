-- Coach sign-up from the app collects a phone number (shown to admins only); members and coaches give a date of birth.
-- Both are nullable: accounts that already exist never gave them. The API makes them required for new sign-ups.
ALTER TABLE "users" ADD COLUMN "phone" TEXT;
ALTER TABLE "users" ADD COLUMN "date_of_birth" DATE;

-- Hand-written guards (Prisma cannot express CHECK constraints).
ALTER TABLE "users" ADD CONSTRAINT "users_phone_format_check" CHECK ("phone" IS NULL OR "phone" ~ '^\+?[0-9 ()-]{7,20}$');
ALTER TABLE "users" ADD CONSTRAINT "users_date_of_birth_range_check" CHECK ("date_of_birth" IS NULL OR ("date_of_birth" >= DATE '1900-01-01' AND "date_of_birth" <= CURRENT_DATE));
