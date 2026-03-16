-- CreateEnum
CREATE TYPE "ScanStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO');

-- CreateEnum
CREATE TYPE "Disposition" AS ENUM ('PENDING', 'FIX', 'SUPPRESS', 'DEFER');

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rootPath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScanTarget" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScanTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scan" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "scanTargetId" TEXT NOT NULL,
    "sourceDir" TEXT NOT NULL,
    "status" "ScanStatus" NOT NULL,
    "severityThreshold" TEXT NOT NULL DEFAULT 'LOW',
    "findingsCount" INTEGER NOT NULL DEFAULT 0,
    "severityBreakdown" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,

    CONSTRAINT "Scan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Finding" (
    "id" TEXT NOT NULL,
    "scanId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "scanTargetId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "ruleIds" JSONB,
    "scanner" TEXT NOT NULL,
    "severity" "Severity" NOT NULL,
    "file" TEXT NOT NULL,
    "startLine" INTEGER NOT NULL,
    "endLine" INTEGER,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "snippet" TEXT,
    "disposition" "Disposition" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "Finding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Project_rootPath_key" ON "Project"("rootPath");

-- CreateIndex
CREATE UNIQUE INDEX "ScanTarget_projectId_path_key" ON "ScanTarget"("projectId", "path");

-- CreateIndex
CREATE INDEX "Scan_projectId_startedAt_idx" ON "Scan"("projectId", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "Finding_scanTargetId_ruleId_file_idx" ON "Finding"("scanTargetId", "ruleId", "file");

-- CreateIndex
CREATE INDEX "Finding_scanId_severity_idx" ON "Finding"("scanId", "severity");

-- AddForeignKey
ALTER TABLE "ScanTarget" ADD CONSTRAINT "ScanTarget_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scan" ADD CONSTRAINT "Scan_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scan" ADD CONSTRAINT "Scan_scanTargetId_fkey" FOREIGN KEY ("scanTargetId") REFERENCES "ScanTarget"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "Scan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_scanTargetId_fkey" FOREIGN KEY ("scanTargetId") REFERENCES "ScanTarget"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
