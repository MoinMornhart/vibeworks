-- SMTP und zuletzt gestartete Version in den Instanz-Einstellungen
ALTER TABLE "Settings" ADD COLUMN "smtpHost" TEXT,
ADD COLUMN "smtpPort" INTEGER,
ADD COLUMN "smtpSecure" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "smtpUser" TEXT,
ADD COLUMN "smtpPassCipher" TEXT,
ADD COLUMN "smtpFrom" TEXT,
ADD COLUMN "lastVersion" TEXT;

-- Benachrichtigungen je Konto
CREATE TABLE "NotificationSettings" (
    "userId" TEXT NOT NULL,
    "ntfyUrl" TEXT,
    "ntfyTokenCipher" TEXT,
    "webhookUrl" TEXT,
    "email" TEXT,
    "events" JSONB NOT NULL DEFAULT '{}',
    "digestSentOn" TEXT,
    "lastSentAt" TIMESTAMP(3),
    "lastError" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationSettings_pkey" PRIMARY KEY ("userId")
);

ALTER TABLE "NotificationSettings" ADD CONSTRAINT "NotificationSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
