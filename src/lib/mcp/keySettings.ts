import { z } from "zod";

// Einstellungen je API-Schlüssel (#48/#49): welche Werkzeuge er nutzen darf
// und wie oft die KI an ihre Pflichten erinnert wird. Ohne Datenbank.

export const KEY_SCOPES = ["read", "tasks", "all"] as const;
export type KeyScope = (typeof KEY_SCOPES)[number];
export const REMINDER_MODES = ["default", "custom", "off"] as const;
export type ReminderMode = (typeof REMINDER_MODES)[number];

/** Immer erlaubt – ohne sie kann die KI die Regeln nicht holen. */
const ALWAYS = new Set(["get_agent_rules", "confirm_agent_rules"]);
/** Zusätzlich zu den lesenden Werkzeugen bei „tasks“. */
const TASK_TOOLS = new Set(["create_task", "create_task_in_projects", "update_task", "add_to_today", "remove_from_today", "start_timer", "stop_timer", "resolve_error", "add_code_memo"]);

export function toolAllowed(tool: { name: string; annotations?: { readOnlyHint?: boolean } }, scope: string): boolean {
  if (scope === "all" || ALWAYS.has(tool.name)) return true;
  if (tool.annotations?.readOnlyHint) return true;
  return scope === "tasks" && TASK_TOOLS.has(tool.name);
}

export const DEFAULT_REMINDER =
  "VibeWorks reminder: keep the task in VibeWorks up to date – status DOING with your name as assignee while you work, BLOCKED with a reason if you are stuck, DONE when finished – follow the task's instructions and pin what you learned with add_code_memo.";

/** Erinnerung für diesen Aufruf – nur bei jedem n-ten (n = every), sonst null. */
export function reminderFor(settings: { reminderMode: string; reminderText: string | null; reminderEvery: number }, callNumber: number): string | null {
  if (settings.reminderMode === "off") return null;
  const every = Math.min(100, Math.max(1, settings.reminderEvery || 10));
  if (callNumber <= 0 || callNumber % every !== 0) return null;
  const custom = settings.reminderText?.trim();
  return settings.reminderMode === "custom" && custom ? `VibeWorks reminder from the user: ${custom}` : DEFAULT_REMINDER;
}

export const keySettingsSchema = z.object({
  scope: z.enum(KEY_SCOPES).optional(),
  reminderMode: z.enum(REMINDER_MODES).optional(),
  reminderText: z.string().trim().max(1000).nullable().optional(),
  reminderEvery: z.number().int().min(1).max(100).optional(),
});
