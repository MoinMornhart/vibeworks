-- Discord-Anbindung (#105)
ALTER TABLE "Settings" ADD COLUMN "discordAppId" TEXT,
ADD COLUMN "discordPublicKey" TEXT,
ADD COLUMN "discordBotTokenCipher" TEXT,
ADD COLUMN "discordClientSecretCipher" TEXT,
ADD COLUMN "discordCommandsAt" TIMESTAMP(3);

CREATE TABLE "DiscordLink" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "guildName" TEXT,
    "discordUserId" TEXT NOT NULL,
    "discordName" TEXT,
    "channelId" TEXT,
    "channelName" TEXT,
    "forward" BOOLEAN NOT NULL DEFAULT true,
    "report" TEXT NOT NULL DEFAULT 'daily',
    "reportSentOn" TEXT,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscordLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DiscordLink_userId_guildId_key" ON "DiscordLink"("userId", "guildId");
CREATE INDEX "DiscordLink_discordUserId_idx" ON "DiscordLink"("discordUserId");

ALTER TABLE "DiscordLink" ADD CONSTRAINT "DiscordLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
