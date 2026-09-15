-- Bearbeiter an Aufgaben (eigener Eintrag und laut Issue) und „gelesen“ für die Glocke
ALTER TABLE "Task" ADD COLUMN "assignee" TEXT,
ADD COLUMN "issueAssignees" TEXT[] DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "Notification" ADD COLUMN "readAt" TIMESTAMP(3);
