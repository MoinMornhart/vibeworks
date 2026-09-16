-- Welche Aufgaben die KI gesehen hat (#76)
ALTER TABLE "McpCall" ADD COLUMN "seenTaskIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
CREATE INDEX "McpCall_seenTaskIds_idx" ON "McpCall" USING GIN ("seenTaskIds");
