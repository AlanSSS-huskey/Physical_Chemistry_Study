-- DropForeignKey
ALTER TABLE "ImageAsset" DROP CONSTRAINT "ImageAsset_uploadedBy_fkey";

-- AlterTable
ALTER TABLE "Content" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "ImageAsset" ADD COLUMN     "purpose" TEXT NOT NULL DEFAULT 'CONTENT',
ALTER COLUMN "uploadedBy" DROP NOT NULL;

-- CreateTable
CREATE TABLE "StudyPreference" (
    "userId" TEXT NOT NULL,
    "fontSize" INTEGER NOT NULL DEFAULT 18,
    "lineHeight" DOUBLE PRECISION NOT NULL DEFAULT 1.8,
    "theme" TEXT NOT NULL DEFAULT 'system',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyPreference_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "ReadingPosition" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contentSlug" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "anchor" TEXT,
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReadingPosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bookmark" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contentSlug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bookmark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalNote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contentSlug" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentDraft" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contentId" TEXT,
    "draftKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "baseVersion" INTEGER,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentRevision" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "action" TEXT NOT NULL DEFAULT 'save',
    "snapshot" JSONB NOT NULL,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailChangeRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "previousEmail" TEXT NOT NULL,
    "emailCanonical" TEXT NOT NULL,
    "newTokenHash" TEXT NOT NULL,
    "oldTokenHash" TEXT NOT NULL,
    "oldConfirmedAt" TIMESTAMP(3),
    "newConfirmedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountDeletionRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountDeletionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StorageDeletion" (
    "id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StorageDeletion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReadingPosition_userId_updatedAt_idx" ON "ReadingPosition"("userId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReadingPosition_userId_contentSlug_locale_key" ON "ReadingPosition"("userId", "contentSlug", "locale");

-- CreateIndex
CREATE INDEX "Bookmark_userId_createdAt_idx" ON "Bookmark"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Bookmark_userId_contentSlug_key" ON "Bookmark"("userId", "contentSlug");

-- CreateIndex
CREATE INDEX "PersonalNote_userId_updatedAt_idx" ON "PersonalNote"("userId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PersonalNote_userId_contentSlug_locale_key" ON "PersonalNote"("userId", "contentSlug", "locale");

-- CreateIndex
CREATE INDEX "ContentDraft_userId_updatedAt_idx" ON "ContentDraft"("userId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ContentDraft_userId_draftKey_key" ON "ContentDraft"("userId", "draftKey");

-- CreateIndex
CREATE INDEX "ContentRevision_contentId_createdAt_idx" ON "ContentRevision"("contentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ContentRevision_contentId_version_key" ON "ContentRevision"("contentId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "EmailChangeRequest_newTokenHash_key" ON "EmailChangeRequest"("newTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "EmailChangeRequest_oldTokenHash_key" ON "EmailChangeRequest"("oldTokenHash");

-- CreateIndex
CREATE INDEX "EmailChangeRequest_userId_idx" ON "EmailChangeRequest"("userId");

-- CreateIndex
CREATE INDEX "EmailChangeRequest_expiresAt_idx" ON "EmailChangeRequest"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "AccountDeletionRequest_tokenHash_key" ON "AccountDeletionRequest"("tokenHash");

-- CreateIndex
CREATE INDEX "AccountDeletionRequest_userId_idx" ON "AccountDeletionRequest"("userId");

-- CreateIndex
CREATE INDEX "AccountDeletionRequest_expiresAt_idx" ON "AccountDeletionRequest"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "StorageDeletion_path_key" ON "StorageDeletion"("path");

-- AddForeignKey
ALTER TABLE "StudyPreference" ADD CONSTRAINT "StudyPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadingPosition" ADD CONSTRAINT "ReadingPosition_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalNote" ADD CONSTRAINT "PersonalNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentDraft" ADD CONSTRAINT "ContentDraft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentDraft" ADD CONSTRAINT "ContentDraft_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentRevision" ADD CONSTRAINT "ContentRevision_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentRevision" ADD CONSTRAINT "ContentRevision_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailChangeRequest" ADD CONSTRAINT "EmailChangeRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountDeletionRequest" ADD CONSTRAINT "AccountDeletionRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageAsset" ADD CONSTRAINT "ImageAsset_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Private application state is served only through authorized server APIs.
ALTER TABLE "StudyPreference" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ReadingPosition" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Bookmark" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PersonalNote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ContentDraft" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ContentRevision" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EmailChangeRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AccountDeletionRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StorageDeletion" ENABLE ROW LEVEL SECURITY;

-- NextAuth database sessions are checked by server APIs. Browser-facing
-- Supabase roles have no direct privileges, including TRUNCATE (outside RLS).
REVOKE ALL ON TABLE "StudyPreference", "ReadingPosition", "Bookmark", "PersonalNote", "ContentDraft", "ContentRevision", "EmailChangeRequest", "AccountDeletionRequest", "StorageDeletion" FROM PUBLIC, anon, authenticated;

-- Identify existing profile uploads while retaining shared article images.
UPDATE "ImageAsset" AS asset SET "purpose" = 'AVATAR' WHERE EXISTS (SELECT 1 FROM "User" AS owner WHERE owner.id = asset."uploadedBy" AND owner.image = '/api/images/' || asset.id);
