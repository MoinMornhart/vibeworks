import { describe, expect, it } from "vitest";
import { applyStep, BUILTIN_WORKFLOWS, nextOpenStep, readResults, readSteps, runNotice, StepError, workflowKeyFor, workflowSaveSchema } from "./aiWorkflowLogic";

const steps = [
  { title: "Tests schreiben", check: "Test schlägt fehl" },
  { title: "Fix umsetzen", check: "" },
  { title: "Abschluss", check: "Alles geprüft" },
];

describe("KI-Workflows (#101)", () => {
  it("mitgelieferte Workflows sind vollständig und zweisprachig", () => {
    const keys = BUILTIN_WORKFLOWS.map((w) => w.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const w of BUILTIN_WORKFLOWS) {
      expect(w.steps.length).toBeGreaterThanOrEqual(3);
      for (const s of w.steps) {
        expect(s.en.title && s.en.check && s.de.title && s.de.check).toBeTruthy();
        expect(s.en.title).not.toMatch(/[äöüß]/);
      }
    }
    // Jeder Workflow mit Aufgabe endet mit der Abschlussprüfung
    expect(BUILTIN_WORKFLOWS.find((w) => w.key === "feature")?.steps.at(-1)?.en.title).toMatch(/Final review/);
  });

  it("Schritte gehen nur der Reihe nach, mit Beleg", () => {
    let r = applyStep(steps, [], 1, "done", "Test in foo.test.ts, schlägt fehl");
    expect(nextOpenStep(steps, r)).toBe(2);
    expect(() => applyStep(steps, r, 3, "done", "zu früh, aber lang genug")).toThrow(/step 2/);
    expect(() => applyStep(steps, r, 2, "done", "ok")).toThrow(StepError);
    expect(() => applyStep(steps, r, 2, "skipped", "")).toThrow(/reason/);
    r = applyStep(steps, r, 2, "skipped", "Fix war schon im Hauptzweig");
    r = applyStep(steps, r, 3, "done", "Alle Punkte der Anfrage geprüft");
    expect(nextOpenStep(steps, r)).toBeNull();
    expect(() => applyStep(steps, r, 3, "done", "noch einmal abhaken")).toThrow(/already/);
  });

  it("Hinweis nennt den nächsten Schritt samt Prüfung, danach keinen mehr", () => {
    const run = { id: "run1", title: "Fehler beheben", steps, results: readResults([{ step: 1, status: "done", note: "x", at: "" }]) };
    const text = runNotice(run) ?? "";
    expect(text).toContain("Step 2/3: Fix umsetzen");
    expect(text).toContain('run "run1", step 2');
    expect(runNotice({ ...run, results: [1, 2, 3].map((step) => ({ step, status: "done" as const, note: "", at: "" })) })).toBeNull();
  });

  it("Schlüssel kollidieren nicht mit mitgelieferten oder vorhandenen", () => {
    expect(workflowKeyFor("Feature", [])).toBe("feature-2");
    expect(workflowKeyFor("Deploy auf Proxmox", ["deploy-auf-proxmox"])).toBe("deploy-auf-proxmox-2");
    expect(workflowKeyFor("!!!", [])).toBe("workflow");
  });

  it("liest gespeicherte Schritte tolerant und prüft Eingaben", () => {
    expect(readSteps([{ title: "Bauen", check: "grün" }, { title: 3 }, null])).toEqual([{ title: "Bauen", check: "grün" }]);
    expect(readSteps("kaputt")).toEqual([]);
    expect(workflowSaveSchema.safeParse({ title: "X1", steps: [] }).success).toBe(false);
    expect(workflowSaveSchema.parse({ title: "Deploy", steps: [{ title: "Bauen" }] }).steps[0].check).toBe("");
  });
});
