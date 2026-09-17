-- Regeln für Benachrichtigungen (#109)
-- AlterTable
ALTER TABLE "NotificationSettings" ADD COLUMN     "rules" JSONB;

