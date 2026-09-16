-- Fehler-Agent: neue Fehler automatisch als Notfix-Aufgabe (#39)
ALTER TABLE "Project" ADD COLUMN "errorAutoTask" TEXT NOT NULL DEFAULT 'off';
