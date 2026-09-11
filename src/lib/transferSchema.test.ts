import { describe, expect, it } from "vitest";
import { EXPORT_FORMAT, importSchema, orderDocs } from "./transferSchema";

describe("Import-Format", () => {
  it("nimmt einen minimalen Export an und füllt Vorgaben", () => {
    const parsed = importSchema.parse({ format: EXPORT_FORMAT, version: 1, projects: [{ name: "Test" }] });
    expect(parsed.projects[0]).toMatchObject({ name: "Test", status: "IDEA", priority: 2, accent: "violet", tasks: [], notes: [] });
    expect(parsed.docs).toEqual([]);
  });

  it("repariert kaputte Einzelwerte statt die Datei abzulehnen", () => {
    const parsed = importSchema.parse({
      format: EXPORT_FORMAT,
      version: 1,
      projects: [{ name: "X", status: "QUATSCH", priority: 9, tasks: [{ title: "A", status: "NEIN", dueDate: "gestern" }] }],
    });
    expect(parsed.projects[0].status).toBe("IDEA");
    expect(parsed.projects[0].priority).toBe(2);
    expect(parsed.projects[0].tasks[0]).toMatchObject({ status: "TODO", dueDate: null });
  });

  it("lehnt fremde Formate und neuere Versionen ab", () => {
    expect(importSchema.safeParse({ format: "etwas-anderes", version: 1 }).success).toBe(false);
    expect(importSchema.safeParse({ format: EXPORT_FORMAT, version: 2 }).success).toBe(false);
  });
});

describe("Reihenfolge der Seiten", () => {
  it("Eltern vor Kindern, auch wenn die Datei anders sortiert ist", () => {
    const ordered = orderDocs([
      { ref: "c", parentRef: "b" },
      { ref: "b", parentRef: "a" },
      { ref: "a", parentRef: null },
    ]);
    expect(ordered.map((d) => d.ref)).toEqual(["a", "b", "c"]);
  });

  it("Verweise ins Leere werden zu Wurzeln, Kreise enden", () => {
    const ordered = orderDocs([
      { ref: "x", parentRef: "fehlt" },
      { ref: "p", parentRef: "q" },
      { ref: "q", parentRef: "p" },
      { ref: "s", parentRef: "s" },
    ]);
    expect(ordered.find((d) => d.ref === "x")?.parentRef).toBeNull();
    expect(ordered.find((d) => d.ref === "s")?.parentRef).toBeNull();
    expect(ordered).toHaveLength(4);
  });
});
