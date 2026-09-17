-- CI-Designer (#107)
ALTER TABLE "Project" ADD COLUMN "ciPipeline" JSONB,
ADD COLUMN "ciPublishedAt" TIMESTAMP(3),
ADD COLUMN "ciPublishedBy" TEXT,
ADD COLUMN "ciPublishedHash" TEXT;
