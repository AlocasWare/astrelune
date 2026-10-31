-- AlterTable
ALTER TABLE "DocumentRevision" ADD COLUMN     "requestKey" VARCHAR(128);

-- AlterTable
ALTER TABLE "WritingActivity" ADD COLUMN "idempotencyKey" VARCHAR(128);

-- Preserve existing activity rows while assigning stable unique legacy keys.
UPDATE "WritingActivity" SET "idempotencyKey" = 'legacy:' || "id"::text WHERE "idempotencyKey" IS NULL;
ALTER TABLE "WritingActivity" ALTER COLUMN "idempotencyKey" SET NOT NULL;

-- CreateTable
CREATE TABLE "OperationalEvent" (
    "id" UUID NOT NULL,
    "actorUserId" UUID,
    "eventType" VARCHAR(80) NOT NULL,
    "resourceType" VARCHAR(40) NOT NULL,
    "resourceId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OperationalEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OperationalEvent_resourceType_resourceId_createdAt_idx" ON "OperationalEvent"("resourceType", "resourceId", "createdAt");

-- CreateIndex
CREATE INDEX "OperationalEvent_actorUserId_createdAt_idx" ON "OperationalEvent"("actorUserId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentRevision_documentId_requestKey_key" ON "DocumentRevision"("documentId", "requestKey");

-- CreateIndex
CREATE UNIQUE INDEX "WritingActivity_userId_documentId_idempotencyKey_key" ON "WritingActivity"("userId", "documentId", "idempotencyKey");

-- Folder nodes are structural containers and cannot store editor content.
ALTER TABLE "Document" ADD CONSTRAINT "Document_folder_content_null" CHECK ("kind" <> 'FOLDER' OR "content" IS NULL);
