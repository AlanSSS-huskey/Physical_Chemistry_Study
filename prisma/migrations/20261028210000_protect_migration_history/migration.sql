-- Migration history belongs to the server-side Prisma application. Keep it
-- unavailable to Data API client roles; the table owner can still run migrations.
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
