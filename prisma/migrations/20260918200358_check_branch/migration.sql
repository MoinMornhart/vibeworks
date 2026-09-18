-- Zweig für den Repo-Check (#125): null heißt Standardzweig.
ALTER TABLE "Project" ADD COLUMN "checkBranch" TEXT;
