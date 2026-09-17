-- Team-Workflows (#82): ein Workflow gehört entweder zu einem Projekt oder zu einem Team.
ALTER TABLE "AiWorkflow" ADD COLUMN     "teamId" TEXT,
ALTER COLUMN "projectId" DROP NOT NULL;

CREATE UNIQUE INDEX "AiWorkflow_teamId_key_key" ON "AiWorkflow"("teamId", "key");

ALTER TABLE "AiWorkflow" ADD CONSTRAINT "AiWorkflow_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AiWorkflow" ADD CONSTRAINT "AiWorkflow_owner_check" CHECK (("projectId" IS NULL) <> ("teamId" IS NULL));

-- Neues Team-Recht „Team-Workflows verwalten“: die Standardrolle Admin im Auslieferungszustand bekommt es,
UPDATE "Role" SET "permissions" = ARRAY['team.invite','team.remove','team.roles','team.workflows','team.manage'] WHERE "id" = 'role-team-admin' AND "key" = 'team.admin' AND "name" = 'Admin' AND "scope" = 'team' AND "description" = 'Verwaltet Mitglieder, Einladungen, Rollen und das Team selbst.' AND "permissions" = ARRAY['team.invite','team.remove','team.roles','team.manage'];
-- ebenso alle übrigen Team-Rollen, die das Team verwalten dürfen.
UPDATE "Role" SET "permissions" = array_append("permissions", 'team.workflows')
  WHERE "scope" = 'team' AND 'team.manage' = ANY("permissions") AND NOT ('team.workflows' = ANY("permissions"));
