-- CI-Status am zwischengespeicherten Repository-Stand
ALTER TABLE "RepoCache" ADD COLUMN "ci" JSONB;

-- Eingehende Webhooks je Projekt
ALTER TABLE "Project" ADD COLUMN "webhookSecretCipher" TEXT,
ADD COLUMN "webhookAt" TIMESTAMP(3);
