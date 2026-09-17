import { describe, expect, it } from "vitest";
import { buildLighthouseWorkflow, LH_MARKER, lighthouseProblems, nextBaseline, parseLighthouseReport, readBaseline, safeLiveUrl } from "./lighthouseLogic";

describe("Lighthouse-Check (#82)", () => {
  it("lässt nur harmlose http(s)-Adressen in die Workflow-Datei", () => {
    expect(safeLiveUrl("https://example.org/app?x=1")).toBe("https://example.org/app?x=1");
    expect(safeLiveUrl("http://example.org")).toBe("http://example.org/");
    // Anführungszeichen und Backticks kodiert die Adresse selbst – danach harmlos
    expect(safeLiveUrl('https://e.org/"x')).toBe("https://e.org/%22x");
    expect(safeLiveUrl("https://e.org/a`b`")).toBe("https://e.org/a%60b%60");
    for (const bad of [null, "", "ftp://example.org", "javascript:alert(1)", "https://user:pw@example.org", "https://e.org/${{ secrets.X }}", "https://e.org/$(id)", "https://e.org/?q=$HOME", `https://e.org/${"a".repeat(600)}`]) {
      expect(safeLiveUrl(bad)).toBeNull();
    }
  });

  it("baut einen Workflow ohne Schreibrechte und ohne GitHub-Ausdrücke", () => {
    const yml = buildLighthouseWorkflow("https://example.org/");
    expect(yml.startsWith(`${LH_MARKER}\n`)).toBe(true);
    expect(yml).toContain("permissions:\n  contents: read\n");
    expect(yml).toContain('      LIVE_URL: "https://example.org/"');
    expect(yml).not.toContain("${{");
    expect(yml).not.toContain("actions/checkout");
    // Alle fremden Actions mit fester Version
    for (const line of yml.split("\n").filter((l) => l.includes("uses:"))) expect(line).toMatch(/@[0-9a-f]{40} /);
    // Python-Block einheitlich eingerückt (sonst bricht das YAML)
    const py = yml.split("python3 - <<'PY'\n")[1].split("\n          PY\n")[0];
    expect(py.split("\n").every((l) => l === "" || l.startsWith("          "))).toBe(true);
    expect(py).toContain('if len(out["brokenLinks"]) < 50:');
    expect(py).toContain('with open("vibeworks-lighthouse.json", "w"');
  });

  it("liest den Bericht tolerant", () => {
    const r = parseLighthouseReport({
      url: "https://example.org/",
      scores: { performance: 91.4, accessibility: 120, seo: "x", bestPractices: 0 },
      metrics: { lcp: 2345.6, cls: 0.12, tbt: -3 },
      brokenLinks: [{ url: "https://example.org/weg", status: 404, text: "Not Found" }, { url: "javascript:alert(1)" }, { url: "http://x.org", status: "kaputt" }],
      error: null,
      tools: { lighthouse: true, lychee: "ja" },
    });
    expect(r.scores).toEqual({ performance: 91, bestPractices: 0 });
    expect(r.metrics).toEqual({ lcp: 2346, cls: 0.12 });
    expect(r.brokenLinks).toEqual([
      { url: "https://example.org/weg", status: 404, text: "Not Found" },
      { url: "http://x.org", status: null, text: "" },
    ]);
    expect(r.tools).toEqual({ lighthouse: true, lychee: false });
    expect(parseLighthouseReport(null)).toMatchObject({ url: "", scores: {}, brokenLinks: [], error: null });
  });

  it("merkt sich den besten Wert und meldet deutliche Einbrüche", () => {
    const first = parseLighthouseReport({ scores: { performance: 90, accessibility: 80, seo: 100 } });
    const base = nextBaseline(first, null);
    expect(base).toEqual({ performance: 90, accessibility: 80, seo: 100 });
    expect(lighthouseProblems(first, base).names).toEqual([]);

    const worse = parseLighthouseReport({ scores: { performance: 80, accessibility: 71, seo: 95, bestPractices: 70 }, brokenLinks: [{ url: "https://e.org/404", status: 404 }] });
    const p = lighthouseProblems(worse, base);
    expect(p.drops).toEqual([{ category: "performance", before: 90, now: 80 }]);
    expect(p.names).toEqual(["performance", "https://e.org/404"]);
    // Einbrüche senken den Maßstab nicht, neue Bereiche kommen dazu
    expect(nextBaseline(worse, base)).toEqual({ performance: 90, accessibility: 80, seo: 100, bestPractices: 70 });
    // Besser als je zuvor hebt ihn
    expect(nextBaseline(parseLighthouseReport({ scores: { performance: 97 } }), base).performance).toBe(97);
  });

  it("liest den gespeicherten Maßstab", () => {
    expect(readBaseline(null)).toBeNull();
    expect(readBaseline({ performance: 90, seo: "x" })).toEqual({ performance: 90 });
  });
});
