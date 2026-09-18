-- Lighthouse-Zeitplan einstellbar machen: Rhythmus und Stundenversatz je Projekt
ALTER TABLE "RepoCache" ADD COLUMN "lhSchedule" TEXT;
ALTER TABLE "RepoCache" ADD COLUMN "lhHour" INTEGER;
