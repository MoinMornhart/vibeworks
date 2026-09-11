-- Öffentliches Portfolio
ALTER TABLE "User" ADD COLUMN "portfolioPublic" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "portfolioBio" TEXT;

ALTER TABLE "Project" ADD COLUMN "inPortfolio" BOOLEAN NOT NULL DEFAULT false;
