-- Additive application changes only. Run after the existing Prisma migrations.
-- This migration never changes unrelated public planner tables or Supabase schemas.
ALTER TABLE "Content"
  ADD COLUMN "translations" JSONB,
  ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "isPublished" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "ImageAsset"
  ADD COLUMN "storagePath" TEXT,
  ADD COLUMN "mimeType" TEXT;

-- Prisma is the server-side application boundary. No direct Data API policies are
-- granted: only the trusted table owner / server role can read these tables.
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Account" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VerificationToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Module" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Content" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ImageAsset" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Entitlement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserEntitlement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserModule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Subscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Purchase" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PurchaseItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Progress" ENABLE ROW LEVEL SECURITY;
