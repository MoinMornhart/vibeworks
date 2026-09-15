-- MCP: Agent-Regeln bestätigt, zuletzt gemeldeter Client, Aufruf-Protokoll
ALTER TABLE "ApiToken" ADD COLUMN "rulesAckAt" TIMESTAMP(3),
ADD COLUMN "clientName" TEXT,
ADD COLUMN "clientVersion" TEXT,
ADD COLUMN "clientProtocol" TEXT;

CREATE TABLE "McpCall" (
    "id" TEXT NOT NULL,
    "tokenId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tool" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "error" TEXT,
    "ms" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "McpCall_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "McpCall_userId_createdAt_idx" ON "McpCall"("userId", "createdAt");
CREATE INDEX "McpCall_createdAt_idx" ON "McpCall"("createdAt");

ALTER TABLE "McpCall" ADD CONSTRAINT "McpCall_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "ApiToken"("id") ON DELETE CASCADE ON UPDATE CASCADE;
