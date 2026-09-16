-- Fingerabdruck der bestätigten Agent-Regeln
ALTER TABLE "ApiToken" ADD COLUMN "rulesVersion" TEXT;
