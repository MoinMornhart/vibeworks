-- Automatischer Import je Git-Verbindung und Fehlerzähler je Repository
ALTER TABLE "GitCredential"
  ADD COLUMN "autoImport" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "importedAt" TIMESTAMP(3),
  ADD COLUMN "importError" TEXT,
  ADD COLUMN "importFails" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "importCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "skipRepos" TEXT[] DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "RepoCache"
  ADD COLUMN "failCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "errorSince" TIMESTAMP(3),
  ADD COLUMN "errorNotified" BOOLEAN NOT NULL DEFAULT false;
