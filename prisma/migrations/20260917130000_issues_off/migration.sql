-- Abgeschaltete Issues pausieren statt dauernd scheitern (#66)
ALTER TABLE "Project" ADD COLUMN "issuesOffAt" TIMESTAMP(3);
