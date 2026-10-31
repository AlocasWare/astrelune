-- CreateTable
CREATE TABLE "NewModel15" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,

    CONSTRAINT "NewModel15_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NewModel15_projectId_idx" ON "NewModel15"("projectId");

-- AddForeignKey
ALTER TABLE "NewModel15" ADD CONSTRAINT "NewModel15_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
