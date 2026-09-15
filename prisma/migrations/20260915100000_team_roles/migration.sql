-- Team-Rollen: Standardrollen mit festen IDs (src/lib/rolesLogic.ts); bestehende
-- Admins und Mitglieder behalten ihre Rechte.
ALTER TABLE "TeamMember" ADD COLUMN "roleId" TEXT;
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "Role" ("id", "scope", "name", "description", "permissions", "key", "updatedAt") VALUES
  ('role-team-admin', 'team', 'Admin', 'Verwaltet Mitglieder, Einladungen, Rollen und das Team selbst.', ARRAY['team.invite','team.remove','team.roles','team.manage'], 'team.admin', CURRENT_TIMESTAMP),
  ('role-team-inviter', 'team', 'Einlader', 'Darf Leute einladen, aber niemanden entfernen.', ARRAY['team.invite'], 'team.inviter', CURRENT_TIMESTAMP),
  ('role-team-member', 'team', 'Mitglied', 'Nimmt teil und sieht die Team-Projekte.', ARRAY[]::TEXT[], 'team.member', CURRENT_TIMESTAMP);

UPDATE "TeamMember" SET "roleId" = CASE WHEN "role" = 'ADMIN' THEN 'role-team-admin' ELSE 'role-team-member' END;

-- Eigene Rollen eines Teams
ALTER TABLE "Role" ADD COLUMN "teamId" TEXT;
ALTER TABLE "Role" ADD CONSTRAINT "Role_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Role_teamId_idx" ON "Role"("teamId");
