-- Erinnerung an die KI mit Ablauf (#100)
ALTER TABLE "ApiToken" ADD COLUMN "reminderUntil" TIMESTAMP(3);
