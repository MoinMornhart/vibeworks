import { describe, expect, it } from "vitest";
import { keyExpiry, keyState, PROJECT_KEY_TOOLS, toolAllowedForKey } from "./projectKeyLogic";
import { MCP_TOOLS } from "./tools";

const base = { disabledAt: null, expiresAt: null, projectScoped: false, projectIds: [] as string[] };

describe("Projekt-Schlüssel (#106)", () => {
  it("Zustand: aktiv, pausiert, abgelaufen, ohne Projekte", () => {
    const now = Date.parse("2026-09-17T12:00:00Z");
    expect(keyState(base, now)).toBe("active");
    expect(keyState({ ...base, disabledAt: new Date(now) }, now)).toBe("paused");
    expect(keyState({ ...base, expiresAt: new Date(now - 1) }, now)).toBe("expired");
    expect(keyState({ ...base, expiresAt: new Date(now + 1) }, now)).toBe("active");
    expect(keyState({ ...base, projectScoped: true }, now)).toBe("empty");
    expect(keyState({ ...base, projectScoped: true, projectIds: ["p1"] }, now)).toBe("active");
  });

  it("Laufzeit ab jetzt", () => {
    const now = Date.parse("2026-09-17T12:00:00Z");
    expect(keyExpiry("7", now)?.toISOString()).toBe("2026-09-24T12:00:00.000Z");
    expect(keyExpiry("never", now)).toBeNull();
  });

  it("nur projektbezogene Werkzeuge – nichts Kontoweites", () => {
    const names = new Set(MCP_TOOLS.map((t) => t.name));
    for (const t of PROJECT_KEY_TOOLS) if (!["get_agent_rules", "confirm_agent_rules"].includes(t)) expect(names.has(t), t).toBe(true);
    for (const t of ["search", "list_docs", "get_doc", "create_doc", "update_doc", "list_prompts", "get_prompt", "get_today", "list_problems", "start_timer", "stop_timer", "add_to_today", "remove_from_today"]) {
      expect(toolAllowedForKey(t, true), t).toBe(false);
      expect(toolAllowedForKey(t, false), t).toBe(true);
    }
    expect(toolAllowedForKey("list_tasks", true)).toBe(true);
  });
});
