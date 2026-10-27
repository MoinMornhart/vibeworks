-- Adresse der Instanz im Admin-Dashboard übernehmen (überschreibt APP_URL, solange die .env gleich bleibt)
ALTER TABLE "Settings" ADD COLUMN "appUrl" TEXT;
ALTER TABLE "Settings" ADD COLUMN "appUrlEnv" TEXT;
