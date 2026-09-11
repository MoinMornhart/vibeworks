-- Eigene Projektvorlagen
CREATE TABLE "ProjectTemplate" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProjectTemplate_ownerId_idx" ON "ProjectTemplate"("ownerId");

ALTER TABLE "ProjectTemplate" ADD CONSTRAINT "ProjectTemplate_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
