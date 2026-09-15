-- Ersteller an Aufgaben und Prüfspur der API-Schlüssel
ALTER TABLE "Task" ADD COLUMN "createdById" TEXT,
ADD COLUMN "createdByName" TEXT,
ADD COLUMN "createdVia" TEXT;

ALTER TABLE "Task" ADD CONSTRAINT "Task_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ApiToken" ADD COLUMN "lastUsedIp" TEXT,
ADD COLUMN "lastUsedUserAgent" TEXT;

-- Ersteller bestehender Aufgaben aus dem Aktivitätsprotokoll („Aufgabe angelegt“ mit taskId)
UPDATE "Task" t
SET "createdById" = a."userId",
    "createdByName" = COALESCE(NULLIF(TRIM(u."displayName"), ''), u."username"),
    "createdVia" = 'web'
FROM "Activity" a
JOIN "User" u ON u."id" = a."userId"
WHERE a."kind" = 'TASK_ADDED' AND a."meta"->>'taskId' = t."id" AND t."createdById" IS NULL;

-- Von VibeWorks selbst gepflegte Aufgaben (Abhängigkeiten, Repo-Check …)
UPDATE "Task" SET "createdVia" = 'auto' WHERE "autoKey" IS NOT NULL AND "createdVia" IS NULL;
