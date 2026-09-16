-- Memo-Netz im Code-Netz (#60)
CREATE TABLE "CodeMemo" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "file" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "authorId" TEXT,
    "authorName" TEXT,
    "via" TEXT NOT NULL DEFAULT 'web',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CodeMemo_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CodeMemo_projectId_file_idx" ON "CodeMemo"("projectId", "file");

ALTER TABLE "CodeMemo" ADD CONSTRAINT "CodeMemo_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
