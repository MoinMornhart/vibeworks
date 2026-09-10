-- Repository-Zugang und Issue-Spiegelung
ALTER TABLE "Project" ADD COLUMN     "issueSync" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "repoTokenCipher" TEXT,
ADD COLUMN     "repoTokenHint" TEXT;

ALTER TABLE "Task" ADD COLUMN     "issueError" TEXT,
ADD COLUMN     "issueNumber" INTEGER,
ADD COLUMN     "issueUrl" TEXT,
ADD COLUMN     "statusChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Bestehende Aufgaben: bestmögliche Schätzung des letzten Statuswechsels
UPDATE "Task" SET "statusChangedAt" = COALESCE("doneAt", "updatedAt");

-- Zwischenspeicher für Commits
CREATE TABLE "RepoCache" (
    "projectId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "webUrl" TEXT NOT NULL,
    "defaultBranch" TEXT,
    "description" TEXT,
    "stars" INTEGER,
    "commits" JSONB NOT NULL DEFAULT '[]',
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "error" TEXT,

    CONSTRAINT "RepoCache_pkey" PRIMARY KEY ("projectId")
);

ALTER TABLE "RepoCache" ADD CONSTRAINT "RepoCache_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
