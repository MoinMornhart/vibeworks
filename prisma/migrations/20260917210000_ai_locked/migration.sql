-- Für KI gesperrte Aufgaben (#76)
ALTER TABLE "Task" ADD COLUMN "aiLocked" BOOLEAN NOT NULL DEFAULT false;
