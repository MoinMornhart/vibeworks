-- Prompt-Bibliothek
CREATE TABLE "Prompt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "uses" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prompt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Prompt_userId_idx" ON "Prompt"("userId");

ALTER TABLE "Prompt" ADD CONSTRAINT "Prompt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Prompt" ADD CONSTRAINT "Prompt_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
