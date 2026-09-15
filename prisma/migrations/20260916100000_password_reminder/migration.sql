-- Passwort-Erinnerung: wann zuletzt gesetzt, nach wie vielen Tagen erinnern, wann zuletzt erinnert
ALTER TABLE "User" ADD COLUMN "passwordChangedAt" TIMESTAMP(3),
ADD COLUMN "passwordReminderDays" INTEGER NOT NULL DEFAULT 180,
ADD COLUMN "passwordRemindedAt" TIMESTAMP(3);

-- Bestehende Passwörter zählen ab jetzt – sonst käme bei allen sofort die Erinnerung
UPDATE "User" SET "passwordChangedAt" = CURRENT_TIMESTAMP WHERE "passwordHash" IS NOT NULL;
