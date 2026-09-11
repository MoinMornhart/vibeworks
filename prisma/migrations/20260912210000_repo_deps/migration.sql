-- Abhängigkeiten-Check (package.json)
ALTER TABLE "RepoCache" ADD COLUMN "deps" JSONB,
ADD COLUMN "depsCheckedAt" TIMESTAMP(3);
