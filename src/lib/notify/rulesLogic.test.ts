import { describe, expect, it } from "vitest";
import { decideNotice, EMPTY_RULES, matchesWords, parseRuleList, readRules } from "./rulesLogic";

const ctx = { event: "issueComment" as const, projectId: "p1", author: "JONIMONI09", text: "Bitte dringend prüfen" };

describe("Regeln für Benachrichtigungen (#109)", () => {
  it("liest gespeicherte Regeln tolerant", () => {
    expect(readRules(null)).toEqual(EMPTY_RULES);
    expect(readRules({ words: ["  Fehler ", "Fehler", 7, ""], people: ["anna"], projects: ["p1"] })).toEqual({ words: ["Fehler"], people: ["anna"], projects: ["p1"] });
    expect(readRules({ words: Array.from({ length: 50 }, (_, i) => `w${i}`) }).words).toHaveLength(30);
  });

  it("zerlegt Eingaben mit Komma und Zeilenumbruch", () => {
    expect(parseRuleList("dringend, Fehler\n  Sicherheit ,,")).toEqual(["dringend", "Fehler", "Sicherheit"]);
  });

  it("findet Wörter ohne Rücksicht auf Groß/klein und Akzente", () => {
    expect(matchesWords(["dringend"], "Bitte DRINGEND prüfen")).toBe(true);
    expect(matchesWords(["größe"], "Die Grosse passt")).toBe(true);
    expect(matchesWords(["fehler"], "alles gut")).toBe(false);
    expect(matchesWords([], "egal")).toBe(false);
  });

  it("wichtige Wörter kommen auch bei ausgeschaltetem Anlass durch", () => {
    const rules = { ...EMPTY_RULES, words: ["dringend"] };
    expect(decideNotice(rules, { issueComment: false }, ctx)).toEqual({ send: true, important: true });
    expect(decideNotice(EMPTY_RULES, { issueComment: false }, ctx)).toEqual({ send: false, important: false });
  });

  it("filtert nach Projekt und Person", () => {
    expect(decideNotice({ ...EMPTY_RULES, projects: ["p2"] }, {}, ctx).send).toBe(false);
    expect(decideNotice({ ...EMPTY_RULES, projects: ["p1"] }, {}, ctx).send).toBe(true);
    expect(decideNotice({ ...EMPTY_RULES, people: ["@jonimoni09"] }, {}, ctx).send).toBe(true);
    expect(decideNotice({ ...EMPTY_RULES, people: ["anna"] }, {}, ctx).send).toBe(false);
    // Ohne Angaben greifen die Filter nicht
    expect(decideNotice({ ...EMPTY_RULES, people: ["anna"], projects: ["p2"] }, {}, { event: "taskDue", text: "x" }).send).toBe(true);
  });
});
