-- Kosten je Projekt
CREATE TABLE "ProjectCost" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "interval" TEXT NOT NULL DEFAULT 'MONTHLY',
    "renewsOn" TEXT,
    "note" TEXT,
    "notifiedFor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectCost_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProjectCost_projectId_idx" ON "ProjectCost"("projectId");

ALTER TABLE "ProjectCost" ADD CONSTRAINT "ProjectCost_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
