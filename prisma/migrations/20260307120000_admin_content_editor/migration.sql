-- Role enum: FREE/PRO/ADMIN -> USER/ADMIN
ALTER TYPE "Role" RENAME TO "Role_old";
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User"
ALTER COLUMN "role" TYPE "Role"
USING (
  CASE
    WHEN "role"::text = 'ADMIN' THEN 'ADMIN'::"Role"
    ELSE 'USER'::"Role"
  END
);
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'USER';

DROP TYPE "Role_old";

-- Content table additions for editor system
ALTER TABLE "Content" ADD COLUMN "module" TEXT;
ALTER TABLE "Content" ADD COLUMN "body" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Content" ALTER COLUMN "subjectSlug" DROP NOT NULL;
ALTER TABLE "Content" ALTER COLUMN "chapterSlug" DROP NOT NULL;

-- Image asset table
CREATE TABLE "ImageAsset" (
  "id" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "uploadedBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ImageAsset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ImageAsset_url_key" ON "ImageAsset"("url");
CREATE INDEX "ImageAsset_uploadedBy_idx" ON "ImageAsset"("uploadedBy");
CREATE INDEX "ImageAsset_createdAt_idx" ON "ImageAsset"("createdAt");

ALTER TABLE "ImageAsset"
ADD CONSTRAINT "ImageAsset_uploadedBy_fkey"
FOREIGN KEY ("uploadedBy") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
