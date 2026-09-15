import { describe, expect, it } from "vitest";
import { CHANGELOG, type ChangelogEntry } from "./changelog";
import { newsSince, NEWS_MAX } from "./news";

const log: ChangelogEntry[] = [
  { version: "0.0.4", date: "", title: "", changes: [{ type: "neu", text: "D", link: "/d" }, { type: "fix", text: "Fix", link: "/fix" }] },
  { version: "0.0.3", date: "", title: "", changes: [{ type: "besser", text: "C", link: "/c" }, { type: "neu", text: "ohne Link" }] },
  { version: "0.0.2", date: "", title: "", changes: [{ type: "neu", text: "B", link: "/b" }] },
];

describe("Hinweise auf neue Funktionen", () => {
  it("alles mit Link seit der letzten Version, ohne Fixes", () => {
    expect(newsSince(log, "0.0.2").map((n) => n.change.text)).toEqual(["D", "C"]);
    expect(newsSince(log, "0.0.4")).toEqual([]);
  });
  it("unbekannte oder fehlende Vorversion: nur der neueste Eintrag", () => {
    expect(newsSince(log, "0.0.1").map((n) => n.version)).toEqual(["0.0.4"]);
    expect(newsSince(log, null).map((n) => n.change.link)).toEqual(["/d"]);
  });
  it("höchstens NEWS_MAX", () => {
    const many: ChangelogEntry[] = [{ version: "1", date: "", title: "", changes: Array.from({ length: 9 }, (_, i) => ({ type: "neu" as const, text: `${i}`, link: `/${i}` })) }, { version: "0", date: "", title: "", changes: [] }];
    expect(newsSince(many, "0")).toHaveLength(NEWS_MAX);
  });
  it("Links im Änderungsverlauf sind Pfade dieser Instanz", () => {
    for (const e of CHANGELOG) for (const c of e.changes) if (c.link) expect(c.link).toMatch(/^\/[^/]/);
  });
});
