-- Every persisted document has an immutable Clerk user id owner.
ALTER TABLE "Document" ADD COLUMN "ownerId" TEXT NOT NULL DEFAULT 'legacy_unowned';
ALTER TABLE "Document" ALTER COLUMN "ownerId" DROP DEFAULT;
CREATE INDEX "Document_ownerId_createdAt_idx" ON "Document"("ownerId", "createdAt");
