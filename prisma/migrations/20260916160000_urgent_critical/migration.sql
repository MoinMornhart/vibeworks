-- Kritische Meldungen mit höchster ntfy-Priorität (#35), standardmäßig an
ALTER TABLE "NotificationSettings" ADD COLUMN "urgentCritical" BOOLEAN NOT NULL DEFAULT true;
