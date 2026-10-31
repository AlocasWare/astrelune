-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "DocumentKind" AS ENUM ('FOLDER', 'CHAPTER', 'SCENE', 'NOTE', 'RESEARCH');

-- CreateEnum
CREATE TYPE "RevisionReason" AS ENUM ('AUTOSAVE_CHECKPOINT', 'MANUAL_CHECKPOINT', 'RESTORE');

-- CreateEnum
CREATE TYPE "ThemePreference" AS ENUM ('SYSTEM', 'LIGHT', 'DARK');

-- CreateEnum
CREATE TYPE "WorldEntryKind" AS ENUM ('CHARACTER', 'LOCATION', 'ORGANIZATION', 'OBJECT', 'EVENT', 'SPECIES', 'CONCEPT', 'CUSTOM');

-- CreateEnum
CREATE TYPE "WritingPeriod" AS ENUM ('DAILY', 'WEEKLY');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "displayName" VARCHAR(80) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "emailVerifiedAt" TIMESTAMPTZ(3),
    "disabledAt" TIMESTAMPTZ(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "lastSeenAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPreferences" (
    "userId" UUID NOT NULL,
    "theme" "ThemePreference" NOT NULL DEFAULT 'SYSTEM',
    "editorFontFamily" VARCHAR(40) NOT NULL DEFAULT 'serif',
    "editorFontSize" INTEGER NOT NULL DEFAULT 18,
    "editorLineHeight" DOUBLE PRECISION NOT NULL DEFAULT 1.7,
    "focusModeDefault" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "UserPreferences_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" VARCHAR(2000),
    "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "archivedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "parentId" UUID,
    "title" VARCHAR(200) NOT NULL,
    "kind" "DocumentKind" NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "content" JSONB,
    "contentSchemaVersion" INTEGER NOT NULL DEFAULT 1,
    "plainText" TEXT NOT NULL DEFAULT '',
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "contentVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentRevision" (
    "id" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "content" JSONB NOT NULL,
    "plainText" TEXT NOT NULL,
    "wordCount" INTEGER NOT NULL,
    "contentSchemaVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" UUID,
    "reason" "RevisionReason" NOT NULL,

    CONSTRAINT "DocumentRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "World" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" VARCHAR(4000),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "World_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectWorld" (
    "projectId" UUID NOT NULL,
    "worldId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectWorld_pkey" PRIMARY KEY ("projectId","worldId")
);

-- CreateTable
CREATE TABLE "WorldEntry" (
    "id" UUID NOT NULL,
    "worldId" UUID NOT NULL,
    "parentId" UUID,
    "name" VARCHAR(200) NOT NULL,
    "kind" "WorldEntryKind" NOT NULL,
    "summary" VARCHAR(2000),
    "content" JSONB NOT NULL,
    "contentSchemaVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "WorldEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorldEntryRelationship" (
    "id" UUID NOT NULL,
    "sourceEntryId" UUID NOT NULL,
    "targetEntryId" UUID NOT NULL,
    "relationshipType" VARCHAR(80) NOT NULL,
    "description" VARCHAR(2000),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorldEntryRelationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentWorldEntry" (
    "documentId" UUID NOT NULL,
    "worldEntryId" UUID NOT NULL,
    "relationshipType" VARCHAR(40) NOT NULL DEFAULT 'REFERENCES',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentWorldEntry_pkey" PRIMARY KEY ("documentId","worldEntryId","relationshipType")
);

-- CreateTable
CREATE TABLE "WritingGoal" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "projectId" UUID,
    "period" "WritingPeriod" NOT NULL,
    "targetWords" INTEGER NOT NULL,
    "startsAt" DATE NOT NULL,
    "endsAt" DATE,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "WritingGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WritingActivity" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "projectId" UUID,
    "documentId" UUID,
    "activityDate" DATE NOT NULL,
    "wordsAdded" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WritingActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_expiresAt_idx" ON "Session"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "Project_ownerId_status_updatedAt_idx" ON "Project"("ownerId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "Document_projectId_parentId_position_idx" ON "Document"("projectId", "parentId", "position");

-- CreateIndex
CREATE INDEX "Document_projectId_updatedAt_idx" ON "Document"("projectId", "updatedAt");

-- CreateIndex
CREATE INDEX "Document_parentId_idx" ON "Document"("parentId");

-- CreateIndex
CREATE INDEX "DocumentRevision_documentId_createdAt_idx" ON "DocumentRevision"("documentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentRevision_documentId_revisionNumber_key" ON "DocumentRevision"("documentId", "revisionNumber");

-- CreateIndex
CREATE INDEX "World_ownerId_updatedAt_idx" ON "World"("ownerId", "updatedAt");

-- CreateIndex
CREATE INDEX "ProjectWorld_worldId_idx" ON "ProjectWorld"("worldId");

-- CreateIndex
CREATE INDEX "WorldEntry_worldId_parentId_name_idx" ON "WorldEntry"("worldId", "parentId", "name");

-- CreateIndex
CREATE INDEX "WorldEntry_worldId_kind_idx" ON "WorldEntry"("worldId", "kind");

-- CreateIndex
CREATE INDEX "WorldEntryRelationship_targetEntryId_idx" ON "WorldEntryRelationship"("targetEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "WorldEntryRelationship_sourceEntryId_targetEntryId_relation_key" ON "WorldEntryRelationship"("sourceEntryId", "targetEntryId", "relationshipType");

-- CreateIndex
CREATE INDEX "DocumentWorldEntry_worldEntryId_idx" ON "DocumentWorldEntry"("worldEntryId");

-- CreateIndex
CREATE INDEX "WritingGoal_userId_period_startsAt_idx" ON "WritingGoal"("userId", "period", "startsAt");

-- CreateIndex
CREATE INDEX "WritingGoal_projectId_idx" ON "WritingGoal"("projectId");

-- CreateIndex
CREATE INDEX "WritingActivity_userId_activityDate_idx" ON "WritingActivity"("userId", "activityDate");

-- CreateIndex
CREATE INDEX "WritingActivity_projectId_activityDate_idx" ON "WritingActivity"("projectId", "activityDate");

-- CreateIndex
CREATE INDEX "WritingActivity_documentId_activityDate_idx" ON "WritingActivity"("documentId", "activityDate");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPreferences" ADD CONSTRAINT "UserPreferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRevision" ADD CONSTRAINT "DocumentRevision_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRevision" ADD CONSTRAINT "DocumentRevision_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "World" ADD CONSTRAINT "World_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectWorld" ADD CONSTRAINT "ProjectWorld_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectWorld" ADD CONSTRAINT "ProjectWorld_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorldEntry" ADD CONSTRAINT "WorldEntry_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorldEntry" ADD CONSTRAINT "WorldEntry_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "WorldEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorldEntryRelationship" ADD CONSTRAINT "WorldEntryRelationship_sourceEntryId_fkey" FOREIGN KEY ("sourceEntryId") REFERENCES "WorldEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorldEntryRelationship" ADD CONSTRAINT "WorldEntryRelationship_targetEntryId_fkey" FOREIGN KEY ("targetEntryId") REFERENCES "WorldEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentWorldEntry" ADD CONSTRAINT "DocumentWorldEntry_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentWorldEntry" ADD CONSTRAINT "DocumentWorldEntry_worldEntryId_fkey" FOREIGN KEY ("worldEntryId") REFERENCES "WorldEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WritingGoal" ADD CONSTRAINT "WritingGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WritingGoal" ADD CONSTRAINT "WritingGoal_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WritingActivity" ADD CONSTRAINT "WritingActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WritingActivity" ADD CONSTRAINT "WritingActivity_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WritingActivity" ADD CONSTRAINT "WritingActivity_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;
