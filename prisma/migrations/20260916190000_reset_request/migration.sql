-- Bitte um ein neues Passwort vom Admin (#43)
ALTER TABLE "User" ADD COLUMN "resetRequestedAt" TIMESTAMP(3);
