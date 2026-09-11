-- Live-Überwachung: Zustand am Projekt …
ALTER TABLE "Project" ADD COLUMN "liveUrl" TEXT,
ADD COLUMN "liveState" TEXT,
ADD COLUMN "liveFails" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "liveMs" INTEGER,
ADD COLUMN "liveError" TEXT,
ADD COLUMN "liveSince" TIMESTAMP(3),
ADD COLUMN "liveCheckedAt" TIMESTAMP(3),
ADD COLUMN "sslExpiresAt" TIMESTAMP(3),
ADD COLUMN "sslCheckedAt" TIMESTAMP(3),
ADD COLUMN "sslNotified" TEXT,
ADD COLUMN "coverUploadId" TEXT,
ADD COLUMN "coverCheckedAt" TIMESTAMP(3);

-- … und die einzelnen Prüfungen
CREATE TABLE "UptimeCheck" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ok" BOOLEAN NOT NULL,
    "status" INTEGER,
    "ms" INTEGER,
    "error" TEXT,

    CONSTRAINT "UptimeCheck_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UptimeCheck_projectId_at_idx" ON "UptimeCheck"("projectId", "at");

ALTER TABLE "UptimeCheck" ADD CONSTRAINT "UptimeCheck_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
