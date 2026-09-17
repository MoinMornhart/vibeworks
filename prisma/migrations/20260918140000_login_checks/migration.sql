-- E-Mail als Notfallweg und Nachfrage nach Notfall-Anmeldungen (#109)
-- AlterTable
ALTER TABLE "MfaPending" ADD COLUMN     "emailCodeAt" TIMESTAMP(3),
ADD COLUMN     "emailCodeHash" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "mfaEmail" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "LoginCheck" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "answer" TEXT,
    "answeredAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LoginCheck_tokenHash_key" ON "LoginCheck"("tokenHash");

-- CreateIndex
CREATE INDEX "LoginCheck_userId_idx" ON "LoginCheck"("userId");

-- AddForeignKey
ALTER TABLE "LoginCheck" ADD CONSTRAINT "LoginCheck_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

