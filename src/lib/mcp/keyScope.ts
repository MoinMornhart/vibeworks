import { AsyncLocalStorage } from "node:async_hooks";

// Projekt-Schlüssel (#106): Während eines MCP-Aufrufs mit einem auf Projekte
// beschränkten Schlüssel liegt hier die Liste der erlaubten Projekte. Die
// zentralen Rechteprüfungen (visibleTo, accessOf) lesen sie – so kann kein
// Werkzeug an der Beschränkung vorbei auf andere Projekte zugreifen.

const store = new AsyncLocalStorage<{ projectIds: string[] }>();

export function runWithProjectScope<T>(projectIds: string[] | null, fn: () => T): T {
  return projectIds ? store.run({ projectIds }, fn) : fn();
}

/** Erlaubte Projekte der laufenden MCP-Anfrage – null: keine Beschränkung. */
export const scopedProjectIds = (): string[] | null => store.getStore()?.projectIds ?? null;
