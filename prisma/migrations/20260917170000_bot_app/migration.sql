-- Bot als GitHub App per Klick
ALTER TABLE "GitCredential" ADD COLUMN "botAppId" TEXT;
ALTER TABLE "GitCredential" ADD COLUMN "botAppSlug" TEXT;
ALTER TABLE "GitCredential" ADD COLUMN "botAppKeyCipher" TEXT;
