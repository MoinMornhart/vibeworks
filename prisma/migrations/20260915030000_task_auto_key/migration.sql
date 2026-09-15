-- Von VibeWorks selbst gepflegte Aufgaben (Abhängigkeiten-Check): je Projekt höchstens eine je Schlüssel
ALTER TABLE "Task" ADD COLUMN "autoKey" TEXT;
CREATE UNIQUE INDEX "Task_projectId_autoKey_key" ON "Task"("projectId", "autoKey");
