-- Einstellungen je MCP-Schlüssel (#48/#49)
ALTER TABLE "ApiToken" ADD COLUMN "scope" TEXT NOT NULL DEFAULT 'all';
ALTER TABLE "ApiToken" ADD COLUMN "reminderMode" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "ApiToken" ADD COLUMN "reminderText" TEXT;
ALTER TABLE "ApiToken" ADD COLUMN "reminderEvery" INTEGER NOT NULL DEFAULT 10;
CREATE INDEX "McpCall_tokenId_createdAt_idx" ON "McpCall"("tokenId", "createdAt");
