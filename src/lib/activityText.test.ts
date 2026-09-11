import { describe, expect, it } from "vitest";
import { makeT } from "@/lib/i18n/messages";
import { activityText, feedKind } from "./activityText";

const de = [makeT("de", "review"), makeT("de", "status")] as const;
const en = [makeT("en", "review"), makeT("en", "status")] as const;

describe("Verlaufstexte", () => {
  it("Statuswechsel in beiden Sprachen", () => {
    const a = { kind: "STATUS_CHANGED" as const, summary: "alt", meta: { from: "IDEA", to: "IN_PROGRESS" } };
    expect(activityText(a, ...de)).toBe("Status: Idee → In Entwicklung");
    expect(activityText(a, ...en)).toBe("Status: Idea → In development");
  });

  it("erledigte Aufgabe wird als „erledigt“ erzählt", () => {
    const a = { kind: "TASK_MOVED" as const, summary: "alt", meta: { from: "DOING", to: "DONE", title: "Login" } };
    expect(feedKind(a)).toBe("TASK_DONE");
    expect(activityText(a, ...de)).toBe("Aufgabe „Login“ erledigt");
    expect(activityText(a, ...en)).toBe("Task “Login” done");
  });

  it("Teilen und Anfragen", () => {
    expect(activityText({ kind: "PROJECT_UPDATED", summary: "", meta: { action: "shareOn" } }, ...en)).toBe("Public link turned on");
    expect(activityText({ kind: "PROJECT_UPDATED", summary: "", meta: { action: "requestApproved", username: "tessa" } }, ...de)).toBe("Zugriffsanfrage von @tessa angenommen");
  });

  it("ältere Einträge ohne Angaben behalten ihren Text", () => {
    expect(activityText({ kind: "TASK_ADDED", summary: "Aufgabe „X“ angelegt", meta: null }, ...en)).toBe("Aufgabe „X“ angelegt");
    expect(activityText({ kind: "TASK_MOVED", summary: "gespeichert", meta: { from: "TODO", to: "DOING", taskId: "t1" } }, ...en)).toBe("gespeichert");
  });
});
