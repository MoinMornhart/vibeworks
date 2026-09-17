// Projekt-Schlüssel (#106): API-Schlüssel, die nur für ausgewählte Projekte
// gelten, ablaufen und sich pausieren lassen. Ohne Datenbank.

/** Werkzeuge, die ein Projekt-Schlüssel nutzen darf – alles andere reicht über einzelne Projekte hinaus (Docs, Prompts, Suche, Tagesplan, Zeiten). */
export const PROJECT_KEY_TOOLS = new Set([
  "get_agent_rules",
  "confirm_agent_rules",
  "list_projects",
  "get_project",
  "update_project",
  "list_tasks",
  "get_task",
  "create_task",
  "create_task_in_projects",
  "update_task",
  "list_task_comments",
  "add_task_comment",
  "create_note",
  "get_note",
  "get_claude_md",
  "get_agent_file",
  "list_code_files",
  "get_code_graph",
  "add_code_memo",
  "delete_code_memo",
  "search_code",
  "get_repo_status",
  "get_ci",
  "save_ci",
  "run_ci",
  "list_errors",
  "resolve_error",
  "review_projects",
  "get_project_structure",
  "update_project_structure",
  "list_workflows",
  "start_workflow",
  "complete_workflow_step",
  "save_workflow",
]);

export const MAX_KEY_PROJECTS = 20;

export const KEY_LIFETIMES = ["1", "7", "30", "never"] as const;
export type KeyLifetime = (typeof KEY_LIFETIMES)[number];

export const keyExpiry = (lifetime: KeyLifetime, now = Date.now()): Date | null => (lifetime === "never" ? null : new Date(now + Number(lifetime) * 86_400_000));

export type KeyState = "active" | "paused" | "expired" | "empty";

/** Ist der Schlüssel benutzbar? Beschränkt und ohne Projekte (alle widerrufen) heißt: nichts mehr. */
export function keyState(t: { disabledAt: Date | null; expiresAt: Date | null; projectScoped: boolean; projectIds: string[] }, now = Date.now()): KeyState {
  if (t.disabledAt) return "paused";
  if (t.expiresAt && t.expiresAt.getTime() <= now) return "expired";
  if (t.projectScoped && t.projectIds.length === 0) return "empty";
  return "active";
}

export const toolAllowedForKey = (tool: string, projectScoped: boolean) => !projectScoped || PROJECT_KEY_TOOLS.has(tool);
