-- Fast "name contains text" search for the People screen (ILIKE '%text%').
-- pg_trgm splits every name into 3-letter pieces ("ama", "mar", "ara") and indexes them, so
-- the database can find "%mar%" without reading every row. A normal btree index cannot help
-- when the text may appear in the middle of the name.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- RAW: Prisma cannot express this index. Partial: deleted accounts are never searched.
CREATE INDEX "users_name_trgm_idx" ON "users" USING GIN ("name" gin_trgm_ops) WHERE "deleted_at" IS NULL;
