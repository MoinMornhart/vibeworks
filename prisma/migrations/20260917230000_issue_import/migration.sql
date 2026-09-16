-- Issues aus dem Git-System übernehmen, Rollen für GitHub-Konten (#69)
ALTER TABLE "Project" ADD COLUMN "issueImport" TEXT NOT NULL DEFAULT 'trusted';
ALTER TABLE "Project" ADD COLUMN "gitPeople" JSONB;
