-- Einladungslinks: einmal nutzbar, mit Ablaufdatum, nur der Hash wird gespeichert
CREATE TABLE "Invite" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "hint" TEXT NOT NULL,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "usedById" TEXT,

    CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Invite_tokenHash_key" ON "Invite"("tokenHash");
CREATE INDEX "Invite_expiresAt_idx" ON "Invite"("expiresAt");
