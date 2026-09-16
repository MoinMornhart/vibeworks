-- Rechte-Prüfung der Git-Zugänge (#98)
ALTER TABLE "GitCredential" ADD COLUMN "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "GitCredential" ADD COLUMN "scopeKind" TEXT;
ALTER TABLE "GitCredential" ADD COLUMN "checkedAt" TIMESTAMP(3);
ALTER TABLE "GitCredential" ADD COLUMN "checkError" TEXT;
ALTER TABLE "GitCredential" ADD COLUMN "checkNotified" TEXT;
