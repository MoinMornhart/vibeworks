-- Neue Rechte (#107): KI-Workflows, CI, Projekt-Schlüssel.
-- Standardrollen, die noch im Auslieferungszustand sind, bekommen die neue Fassung:
UPDATE "Role" SET "permissions" = ARRAY['tasks.edit','tasks.delete','notes.edit','project.edit','costs.edit','time.track','git.sync','live.check','errors.manage','workflows.manage','ci.manage'] WHERE "id" = 'role-project-editor' AND "key" = 'project.editor' AND "name" = 'Bearbeiter' AND "scope" = 'project' AND "description" = 'Ändert Inhalte, Status und Kosten – Mitglieder verwaltet er nicht.' AND "permissions" = ARRAY['tasks.edit','tasks.delete','notes.edit','project.edit','costs.edit','time.track','git.sync','live.check','errors.manage'];
UPDATE "Role" SET "permissions" = ARRAY['tasks.edit','tasks.delete','notes.edit','project.edit','costs.edit','time.track','git.sync','live.check','errors.manage','workflows.manage','ci.manage','members.invite','keys.grant'] WHERE "id" = 'role-project-manager' AND "key" = 'project.manager' AND "name" = 'Manager' AND "scope" = 'project' AND "description" = 'Wie Bearbeiter und darf Mitglieder einladen und verwalten.' AND "permissions" = ARRAY['tasks.edit','tasks.delete','notes.edit','project.edit','costs.edit','time.track','git.sync','live.check','errors.manage','members.invite'];
UPDATE "Role" SET "permissions" = ARRAY['tasks.edit','notes.edit','time.track','git.sync','ci.manage','live.check','errors.manage'] WHERE "id" = 'role-project-bughunter' AND "key" = 'project.bughunter' AND "name" = 'Bughunter' AND "scope" = 'project' AND "description" = 'Findet und behebt Fehler: Aufgaben, Notizen, Zeit, Git- und Live-Prüfung, Fehler-Eingang – ohne Mitglieder, Kosten und Projektangaben.' AND "permissions" = ARRAY['tasks.edit','notes.edit','time.track','git.sync','live.check','errors.manage'];

-- Alle übrigen Rollen: wer bisher über „Projektangaben ändern“ Workflows pflegen und über
-- „Mitglieder einladen“ Schlüssel freigeben durfte, behält das. „CI verwalten“ bekommen
-- angepasste Standardrollen, die Git prüfen dürfen.
UPDATE "Role" SET "permissions" = array_append("permissions", 'workflows.manage')
  WHERE "scope" = 'project' AND 'project.edit' = ANY("permissions") AND NOT ('workflows.manage' = ANY("permissions"));
UPDATE "Role" SET "permissions" = array_append("permissions", 'keys.grant')
  WHERE "scope" = 'project' AND 'members.invite' = ANY("permissions") AND NOT ('keys.grant' = ANY("permissions"));
UPDATE "Role" SET "permissions" = array_append("permissions", 'ci.manage')
  WHERE "id" IN ('role-project-editor', 'role-project-manager', 'role-project-bughunter') AND 'git.sync' = ANY("permissions") AND NOT ('ci.manage' = ANY("permissions"));
