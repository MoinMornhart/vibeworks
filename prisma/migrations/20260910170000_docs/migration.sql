-- Mini-Docs: Seiten im Baum (Markdown, gespeicherte Webseiten, eigene HTML-Seiten)
-- CreateEnum
CREATE TYPE "DocKind" AS ENUM ('PAGE', 'WEB', 'HTML');

-- CreateEnum
CREATE TYPE "DocShare" AS ENUM ('PRIVATE', 'ACCOUNTS', 'PUBLIC');

-- CreateTable
CREATE TABLE "Doc" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "parentId" TEXT,
    "kind" "DocKind" NOT NULL DEFAULT 'PAGE',
    "title" TEXT NOT NULL,
    "icon" TEXT,
    "content" TEXT NOT NULL DEFAULT '',
    "sourceUrl" TEXT,
    "archive" TEXT,
    "archivedAt" TIMESTAMP(3),
    "position" INTEGER NOT NULL DEFAULT 0,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "share" "DocShare" NOT NULL DEFAULT 'PRIVATE',
    "shareToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Doc_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Doc_shareToken_key" ON "Doc"("shareToken");

-- CreateIndex
CREATE INDEX "Doc_ownerId_parentId_position_idx" ON "Doc"("ownerId", "parentId", "position");

-- AddForeignKey
ALTER TABLE "Doc" ADD CONSTRAINT "Doc_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Doc" ADD CONSTRAINT "Doc_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Doc"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Volltextsuche über Docs – derselbe Ausdruck wie in src/app/api/search/route.ts
CREATE INDEX "Doc_fulltext_idx" ON "Doc"
  USING GIN (to_tsvector('german', coalesce("title", '') || ' ' || "content"));
