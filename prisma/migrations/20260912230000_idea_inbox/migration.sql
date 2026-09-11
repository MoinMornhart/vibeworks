-- Ideen-Eingang
ALTER TABLE "User" ADD COLUMN "inboxToken" TEXT,
ADD COLUMN "inboxNtfyUrl" TEXT,
ADD COLUMN "inboxNtfySince" TEXT;

CREATE UNIQUE INDEX "User_inboxToken_key" ON "User"("inboxToken");

CREATE TABLE "InboxItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "url" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InboxItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InboxItem_userId_createdAt_idx" ON "InboxItem"("userId", "createdAt");

ALTER TABLE "InboxItem" ADD CONSTRAINT "InboxItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
