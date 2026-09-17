-- Lighthouse-Check der Live-Seite (#82)
-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "lighthouse" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "RepoCache" ADD COLUMN     "lhBaseline" JSONB,
ADD COLUMN     "lhError" TEXT,
ADD COLUMN     "lhFetchedAt" TIMESTAMP(3),
ADD COLUMN     "lhInstalledAt" TIMESTAMP(3),
ADD COLUMN     "lhReport" JSONB,
ADD COLUMN     "lhRunAt" TIMESTAMP(3),
ADD COLUMN     "lhRunUrl" TEXT,
ADD COLUMN     "lhStatus" TEXT;

