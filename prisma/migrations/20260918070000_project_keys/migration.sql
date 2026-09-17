-- Projekt-Schlüssel (#106)
ALTER TABLE "ApiToken" ADD COLUMN "projectScoped" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "projectIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "expiresAt" TIMESTAMP(3),
ADD COLUMN "disabledAt" TIMESTAMP(3);

CREATE INDEX "ApiToken_projectIds_idx" ON "ApiToken" USING GIN ("projectIds");
