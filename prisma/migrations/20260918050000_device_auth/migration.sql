-- Geräte-Anmeldung für KI-Programme (#104)
CREATE TABLE "DeviceAuth" (
    "id" TEXT NOT NULL,
    "deviceCodeHash" TEXT NOT NULL,
    "userCode" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'tasks',
    "ip" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "userId" TEXT,
    "tokenId" TEXT,
    "tokenCipher" TEXT,
    "lastPollAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceAuth_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DeviceAuth_deviceCodeHash_key" ON "DeviceAuth"("deviceCodeHash");
CREATE UNIQUE INDEX "DeviceAuth_userCode_key" ON "DeviceAuth"("userCode");
CREATE INDEX "DeviceAuth_expiresAt_idx" ON "DeviceAuth"("expiresAt");
