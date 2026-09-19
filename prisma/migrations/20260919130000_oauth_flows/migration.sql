-- OAuth-Anmeldung für KI-Programme (#141): Autorisierungs-Codes mit PKCE.
CREATE TABLE "OAuthFlow" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "codeChallenge" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'tasks',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "userId" TEXT,
    "tokenId" TEXT,
    "tokenCipher" TEXT,
    "redirectUri" TEXT NOT NULL,
    "ip" TEXT,
    "lastPollAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthFlow_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OAuthFlow_clientId_idx" ON "OAuthFlow"("clientId");
CREATE INDEX "OAuthFlow_expiresAt_idx" ON "OAuthFlow"("expiresAt");
