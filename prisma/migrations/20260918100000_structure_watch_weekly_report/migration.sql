-- Aufbau-Wächter und Wochenbericht (#82)
ALTER TABLE "Project" ADD COLUMN "structureCheckedOn" TEXT;
ALTER TABLE "NotificationSettings" ADD COLUMN "weeklyReportOn" TEXT;
