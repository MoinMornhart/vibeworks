-- Projekt-Friedhof
ALTER TABLE "Project" ADD COLUMN "buriedAt" TIMESTAMP(3),
ADD COLUMN "epitaph" TEXT,
ADD COLUMN "causeOfDeath" TEXT,
ADD COLUMN "statusBeforeBurial" "ProjectStatus",
ADD COLUMN "nudgeSnoozedUntil" TIMESTAMP(3);
