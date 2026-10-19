-- Leinwand/Seite mit bestimmten Konten teilen (#211): Ansehen oder Bearbeiten.
-- Nur angemeldete Nutzer, kein öffentlicher Zugriff. Der Besitzer steht
-- weiterhin in Doc.ownerId; hier stehen die eingeladenen Konten mit Rolle.
CREATE TABLE "DocAccess" (
    "docId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ProjectRole" NOT NULL DEFAULT 'VIEWER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocAccess_pkey" PRIMARY KEY ("docId","userId")
);

CREATE INDEX "DocAccess_userId_idx" ON "DocAccess"("userId");

ALTER TABLE "DocAccess" ADD CONSTRAINT "DocAccess_docId_fkey" FOREIGN KEY ("docId") REFERENCES "Doc"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocAccess" ADD CONSTRAINT "DocAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
