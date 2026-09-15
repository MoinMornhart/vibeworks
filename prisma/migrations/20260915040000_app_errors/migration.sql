-- Fehler-Eingang: Schlüssel je Projekt und zusammengefasste Fehler
ALTER TABLE "Project" ADD COLUMN "errorKey" TEXT;
CREATE UNIQUE INDEX "Project_errorKey_key" ON "Project"("errorKey");

CREATE TABLE "AppError" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "type" TEXT,
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "url" TEXT,
    "release" TEXT,
    "environment" TEXT,
    "userAgent" TEXT,
    "count" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'open',
    "firstSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "taskId" TEXT,

    CONSTRAINT "AppError_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AppError_projectId_fingerprint_key" ON "AppError"("projectId", "fingerprint");
CREATE INDEX "AppError_projectId_status_lastSeen_idx" ON "AppError"("projectId", "status", "lastSeen");

ALTER TABLE "AppError" ADD CONSTRAINT "AppError_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
