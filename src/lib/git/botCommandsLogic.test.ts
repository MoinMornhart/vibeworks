import { describe, expect, it } from "vitest";
import { BOT_MARKER, describeCommand, HELP_TEXT, infoText, mayCommand, mentionsBot, parseCommands, parseDue, replyText, REPLY_MARKER } from "./botCommandsLogic";

describe("Bot-Befehle erkennen", () => {
  it("liest Befehle zeilenweise, auch mit Erwähnung davor", () => {
    expect(parseCommands("Passt so.\n/status erledigt\n@vibeworks-bot /prio hoch\n/übernehmen")).toEqual([
      { kind: "status", status: "DONE" },
      { kind: "prio", priority: 3 },
      { kind: "assign", who: null },
    ]);
    expect(parseCommands("/status in arbeit")).toEqual([{ kind: "status", status: "DOING" }]);
    expect(parseCommands("/erledigt\n/fällig 01.10.2026\n/ki Nur Tests anpassen")).toEqual([
      { kind: "status", status: "DONE" },
      { kind: "due", date: "2026-10-01" },
      { kind: "note", text: "Nur Tests anpassen" },
    ]);
  });

  it("ignoriert Zitate, Code und eigene Kommentare", () => {
    expect(parseCommands("> /status erledigt\n```\n/prio 4\n```")).toEqual([]);
    expect(parseCommands(`/status erledigt\n${BOT_MARKER}`)).toEqual([]);
    expect(parseCommands(`/status erledigt\n${REPLY_MARKER}`)).toEqual([]);
    expect(parseCommands("Pfad /usr/bin ist wichtig")).toEqual([]);
  });

  it("meldet Unbekanntes und falsche Werte", () => {
    expect(parseCommands("/tanzen")).toEqual([{ kind: "unknown", raw: "/tanzen", reason: "command" }]);
    expect(parseCommands("/prio 9")[0]).toMatchObject({ kind: "unknown", reason: "value" });
    expect(parseCommands("/fällig morgen")[0]).toMatchObject({ kind: "unknown", reason: "value" });
    expect(parseCommands("/übernehmen <script>")[0]).toMatchObject({ kind: "unknown", reason: "value" });
  });

  it("höchstens fünf Befehle je Kommentar", () => {
    expect(parseCommands(Array(9).fill("/info").join("\n"))).toHaveLength(5);
  });
});

describe("parseDue", () => {
  it("versteht ISO, deutsches Datum und „keins“", () => {
    expect(parseDue("2026-02-28")).toBe("2026-02-28");
    expect(parseDue("5.3.2026")).toBe("2026-03-05");
    expect(parseDue("keins")).toBeNull();
    expect(parseDue("2026-02-30")).toBeUndefined();
    expect(parseDue("bald")).toBeUndefined();
  });
});

describe("Rechte und Erwähnungen", () => {
  it("nur Schreibrecht darf Befehle geben", () => {
    expect(mayCommand("write")).toBe(true);
    expect(mayCommand("admin")).toBe(true);
    expect(mayCommand("read")).toBe(false);
    expect(mayCommand(null)).toBe(false);
  });
  it("erkennt die Erwähnung des Bots", () => {
    expect(mentionsBot("Hey @vibeworks-moin[bot], was geht?", "vibeworks-moin[bot]")).toBe(true);
    expect(mentionsBot("Hallo @VibeWorks", null)).toBe(true);
    expect(mentionsBot("nichts", "x[bot]")).toBe(false);
    expect(mentionsBot(`@vibeworks ${BOT_MARKER}`, null)).toBe(false);
  });
});

describe("Antworten", () => {
  it("baut Antwort mit Marke, Info und Hilfe", () => {
    const text = replyText([describeCommand({ kind: "status", status: "DONE" })], infoText({ title: "T", status: "DONE", priority: 3, assignee: null, dueDate: "2026-10-01", aiNote: null, url: "https://vw/x" }), "anna");
    expect(text).toContain("@anna");
    expect(text).toContain("✅ Status → Erledigt");
    expect(text).toContain("Fällig: 01.10.2026");
    expect(text.endsWith(BOT_MARKER)).toBe(true);
    expect(HELP_TEXT).toContain("/status");
  });
});
