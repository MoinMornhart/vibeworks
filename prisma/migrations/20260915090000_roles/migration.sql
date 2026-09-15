-- Rollen: benannte Rechte-Sammlungen für Projekte. Standardrollen mit festen IDs
-- (src/lib/rolesLogic.ts); bestehende Mitglieder und Team-Freigaben behalten ihre Rechte.
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "key" TEXT,
    "ownerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Role_key_key" ON "Role"("key");
CREATE INDEX "Role_scope_ownerId_idx" ON "Role"("scope", "ownerId");
ALTER TABLE "Role" ADD CONSTRAINT "Role_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectMember" ADD COLUMN "roleId" TEXT;
ALTER TABLE "ProjectTeam" ADD COLUMN "roleId" TEXT;
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectTeam" ADD CONSTRAINT "ProjectTeam_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "Role" ("id", "scope", "name", "description", "permissions", "key", "updatedAt") VALUES
  ('role-project-viewer', 'project', 'Betrachter', 'Sieht alles, ändert nichts.', ARRAY[]::TEXT[], 'project.viewer', CURRENT_TIMESTAMP),
  ('role-project-contributor', 'project', 'Mitwirkender', 'Arbeitet an Aufgaben mit und erfasst Zeit.', ARRAY['tasks.edit','time.track'], 'project.contributor', CURRENT_TIMESTAMP),
  ('role-project-editor', 'project', 'Bearbeiter', 'Ändert Inhalte, Status und Kosten – Mitglieder verwaltet er nicht.', ARRAY['tasks.edit','tasks.delete','notes.edit','project.edit','costs.edit','time.track','git.sync','live.check','errors.manage'], 'project.editor', CURRENT_TIMESTAMP),
  ('role-project-manager', 'project', 'Manager', 'Wie Bearbeiter und darf Mitglieder einladen und verwalten.', ARRAY['tasks.edit','tasks.delete','notes.edit','project.edit','costs.edit','time.track','git.sync','live.check','errors.manage','members.invite'], 'project.manager', CURRENT_TIMESTAMP);

UPDATE "ProjectMember" SET "roleId" = CASE WHEN "role" = 'EDITOR' THEN 'role-project-editor' ELSE 'role-project-viewer' END;
UPDATE "ProjectTeam" SET "roleId" = CASE WHEN "role" = 'EDITOR' THEN 'role-project-editor' ELSE 'role-project-viewer' END;
