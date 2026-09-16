-- KI-Schritte je Aufgabe im Info-Fenster (#48/#49)
ALTER TABLE "McpCall" ADD COLUMN "taskId" TEXT;
CREATE INDEX "McpCall_taskId_createdAt_idx" ON "McpCall"("taskId", "createdAt");
