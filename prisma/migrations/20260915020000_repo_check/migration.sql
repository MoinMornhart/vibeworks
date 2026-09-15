-- Repo-Check: Stand des GitHub-Workflows und sein Bericht je Repository
ALTER TABLE "RepoCache"
  ADD COLUMN "checkStatus" TEXT,
  ADD COLUMN "checkReport" JSONB,
  ADD COLUMN "checkRunUrl" TEXT,
  ADD COLUMN "checkRunAt" TIMESTAMP(3),
  ADD COLUMN "checkFetchedAt" TIMESTAMP(3),
  ADD COLUMN "checkError" TEXT;

ALTER TABLE "RepoCache" ADD COLUMN "checkInstalledAt" TIMESTAMP(3);

-- Je Projekt abschaltbar (Standard: an)
ALTER TABLE "Project" ADD COLUMN "repoCheck" BOOLEAN NOT NULL DEFAULT true;
