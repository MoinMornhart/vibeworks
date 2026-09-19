-- State des Programms mitführen, damit die Rückkehr nach der Freigabe ihn unverändert mitbringt.
ALTER TABLE "OAuthFlow" ADD COLUMN "state" TEXT;
