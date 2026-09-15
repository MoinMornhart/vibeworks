-- Bot-Konto für Issues an der Git-Verbindung
ALTER TABLE "GitCredential" ADD COLUMN "botCipher" TEXT,
ADD COLUMN "botHint" TEXT,
ADD COLUMN "botLogin" TEXT;

-- Standardrolle „Bughunter“ (src/lib/rolesLogic.ts)
INSERT INTO "Role" ("id", "scope", "name", "description", "permissions", "key", "updatedAt") VALUES
  ('role-project-bughunter', 'project', 'Bughunter', 'Findet und behebt Fehler: Aufgaben, Notizen, Zeit, Git- und Live-Prüfung, Fehler-Eingang – ohne Mitglieder, Kosten und Projektangaben.', ARRAY['tasks.edit','notes.edit','time.track','git.sync','live.check','errors.manage'], 'project.bughunter', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
