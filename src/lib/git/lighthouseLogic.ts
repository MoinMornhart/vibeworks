// Lighthouse-Check der Live-Seite (#82) ohne Netz und Datenbank: die
// Workflow-Vorlage für GitHub Actions, der Bericht daraus und was davon eine
// „deutliche Verschlechterung“ ist.

export const LH_FILE = "vibeworks-lighthouse.yml";
export const LH_PATH = `.github/workflows/${LH_FILE}`;
export const LH_ARTIFACT = "vibeworks-lighthouse";
export const LH_REPORT_FILE = "vibeworks-lighthouse.json";
/** Erste Zeile – nur Dateien mit dieser Zeile ändert oder entfernt VibeWorks. */
export const LH_MARKER = "# Von VibeWorks angelegt: Lighthouse-Check der Live-Seite – Änderungen bitte in VibeWorks vornehmen.";

export const LH_CATEGORIES = ["performance", "accessibility", "bestPractices", "seo"] as const;
export type LhCategory = (typeof LH_CATEGORIES)[number];
/** Ab so vielen Punkten unter dem besten bisherigen Wert gilt es als deutlich schlechter. */
export const LH_DROP = 10;
const MAX_LINKS = 50;

export type LhScores = Partial<Record<LhCategory, number>>;

export interface LighthouseReport {
  url: string;
  finishedAt: string | null;
  scores: LhScores;
  /** Millisekunden, CLS ohne Einheit */
  metrics: { lcp?: number; fcp?: number; tbt?: number; cls?: number };
  brokenLinks: Array<{ url: string; status: number | null; text: string }>;
  error: string | null;
  tools: { lighthouse: boolean; lychee: boolean };
}

/**
 * Live-Adresse für die Workflow-Datei – nur http(s) und ohne Zeichen, mit
 * denen sich YAML, Shell oder GitHub-Ausdrücke aufbrechen ließen.
 */
export function safeLiveUrl(value: string | null | undefined): string | null {
  if (!value || value.length > 500) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password) return null;
  const text = url.toString();
  return /[\s"'`$\\{}<>]/.test(text) ? null : text;
}

const SUMMARY = `import datetime, json, os

def load(path):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None

out = {
    "version": 1,
    "url": os.environ.get("LIVE_URL", ""),
    "finishedAt": datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
    "tools": {},
    "scores": {},
    "metrics": {},
    "brokenLinks": [],
    "error": None,
}

lh = load("lh.json")
out["tools"]["lighthouse"] = lh is not None
if lh:
    if lh.get("runtimeError"):
        out["error"] = str((lh.get("runtimeError") or {}).get("message") or "")[:300]
    for key, name in (("performance", "performance"), ("accessibility", "accessibility"), ("best-practices", "bestPractices"), ("seo", "seo")):
        score = ((lh.get("categories") or {}).get(key) or {}).get("score")
        if isinstance(score, (int, float)):
            out["scores"][name] = round(score * 100)
    audits = lh.get("audits") or {}
    for key, name in (("largest-contentful-paint", "lcp"), ("first-contentful-paint", "fcp"), ("total-blocking-time", "tbt"), ("cumulative-layout-shift", "cls")):
        value = (audits.get(key) or {}).get("numericValue")
        if isinstance(value, (int, float)):
            out["metrics"][name] = round(value, 3) if name == "cls" else round(value)
elif not out["error"]:
    out["error"] = "Lighthouse lieferte keinen Bericht"

links = load("links.json")
out["tools"]["lychee"] = links is not None
for items in ((links or {}).get("error_map") or (links or {}).get("fail_map") or {}).values():
    for x in items or []:
        status = x.get("status") if isinstance(x, dict) else None
        code = status.get("code") if isinstance(status, dict) else None
        text = status.get("text") if isinstance(status, dict) else status
        if len(out["brokenLinks"]) < ${MAX_LINKS}:
            out["brokenLinks"].append({"url": str(x.get("url", ""))[:500], "status": code if isinstance(code, int) else None, "text": str(text or "")[:200]})

with open("${LH_REPORT_FILE}", "w", encoding="utf-8") as f:
    json.dump(out, f)
print(json.dumps({"scores": out["scores"], "brokenLinks": len(out["brokenLinks"])}))`;

/** Cron für den gewählten Rhythmus, mit Stundenversatz aus der Einstellung. */
const LH_SCHEDULES = {
  daily: (h: number) => `${((41 + h) % 60 >= 60 ? 0 : 41)} ${(5 + h) % 24} * * *`,
  weekly: (h: number) => `41 ${(5 + h) % 24} * * 1`,
} as const;
export type LhSchedule = keyof typeof LH_SCHEDULES;

export function lighthouseCron(schedule: LhSchedule, hour = 0): string {
  return LH_SCHEDULES[schedule](hour);
}

/** Workflow für eine geprüfte Live-Adresse (siehe safeLiveUrl). */
export function buildLighthouseWorkflow(liveUrl: string, cron = "41 5 * * 1"): string {
  return [
    LH_MARKER,
    "# Prüft nach Zeitplan Leistung, Barrierefreiheit, Best Practices und SEO (Lighthouse)",
    "# sowie kaputte Links (lychee) – kostenlos im GitHub-Runner, ohne KI und ohne Zugriff auf den Code.",
    "# Datei löschen = Check aus.",
    "name: VibeWorks Lighthouse",
    "",
    "on:",
    "  push:",
    `    paths: [${JSON.stringify(LH_PATH)}]`,
    "  schedule:",
    `    - cron: ${JSON.stringify(cron)}`,
    "  workflow_dispatch:",
    "",
    "permissions:",
    "  contents: read",
    "",
    "concurrency:",
    "  group: vibeworks-lighthouse",
    "  cancel-in-progress: true",
    "",
    "jobs:",
    "  lighthouse:",
    "    runs-on: ubuntu-latest",
    "    timeout-minutes: 15",
    "    env:",
    `      LIVE_URL: ${JSON.stringify(liveUrl)}`,
    "    steps:",
    "      - name: Lighthouse",
    "        continue-on-error: true",
    "        run: >-",
    '          npx -y lighthouse@12 "$LIVE_URL" --output=json --output-path=lh.json --quiet',
    "          --only-categories=performance,accessibility,best-practices,seo",
    '          --chrome-flags="--headless=new --no-sandbox"',
    "",
    "      - name: Kaputte Links (lychee)",
    "        continue-on-error: true",
    "        run: >-",
    '          docker run --rm -v "$PWD:/out" lycheeverse/lychee:latest',
    '          --format json --output /out/links.json --max-concurrency 8 --timeout 20 --no-progress "$LIVE_URL"',
    "",
    "      - name: Zusammenfassen",
    "        run: |",
    "          python3 - <<'PY'",
    ...SUMMARY.split("\n").map((l) => (l ? `          ${l}` : "")),
    "          PY",
    "",
    "      - uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4",
    "        with:",
    `          name: ${LH_ARTIFACT}`,
    `          path: ${LH_REPORT_FILE}`,
    "          retention-days: 14",
    "",
  ].join("\n");
}

const num = (v: unknown, min: number, max: number): number | undefined => (typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : undefined);
const str = (v: unknown, max: number): string => (typeof v === "string" ? v.slice(0, max) : "");
const httpUrl = (v: unknown): string | null => {
  const s = str(v, 500);
  return /^https?:\/\//i.test(s) ? s : null;
};

/** Bericht aus dem Artefakt tolerant lesen – Unbekanntes fällt weg. */
export function parseLighthouseReport(raw: unknown): LighthouseReport {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const scoresIn = (o.scores && typeof o.scores === "object" ? o.scores : {}) as Record<string, unknown>;
  const metricsIn = (o.metrics && typeof o.metrics === "object" ? o.metrics : {}) as Record<string, unknown>;
  const toolsIn = (o.tools && typeof o.tools === "object" ? o.tools : {}) as Record<string, unknown>;
  const scores: LhScores = {};
  for (const c of LH_CATEGORIES) {
    const v = num(scoresIn[c], 0, 100);
    if (v !== undefined) scores[c] = Math.round(v);
  }
  const metrics: LighthouseReport["metrics"] = {};
  for (const m of ["lcp", "fcp", "tbt"] as const) {
    const v = num(metricsIn[m], 0, 600_000);
    if (v !== undefined) metrics[m] = Math.round(v);
  }
  const cls = num(metricsIn.cls, 0, 100);
  if (cls !== undefined) metrics.cls = cls;
  const brokenLinks = (Array.isArray(o.brokenLinks) ? o.brokenLinks : []).flatMap((x) => {
    const l = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
    const url = httpUrl(l.url);
    if (!url) return [];
    const status = num(l.status, 100, 999);
    return [{ url, status: status === undefined ? null : Math.round(status), text: str(l.text, 200) }];
  });
  return {
    url: httpUrl(o.url) ?? "",
    finishedAt: str(o.finishedAt, 40) || null,
    scores,
    metrics,
    brokenLinks: brokenLinks.slice(0, MAX_LINKS),
    error: str(o.error, 300) || null,
    tools: { lighthouse: toolsIn.lighthouse === true, lychee: toolsIn.lychee === true },
  };
}

/** Bester bisheriger Wert je Bereich – Verbesserungen heben ihn, Einbrüche nicht. */
export function nextBaseline(report: LighthouseReport, baseline: LhScores | null): LhScores {
  const next: LhScores = { ...(baseline ?? {}) };
  for (const c of LH_CATEGORIES) {
    const now = report.scores[c];
    if (now !== undefined && (next[c] === undefined || now > next[c]!)) next[c] = now;
  }
  return next;
}

export interface LhProblems {
  names: string[];
  drops: Array<{ category: LhCategory; before: number; now: number }>;
  links: LighthouseReport["brokenLinks"];
}

/** Deutliche Einbrüche gegenüber dem besten Wert und kaputte Links – die Namen tragen die Sammel-Aufgabe. */
export function lighthouseProblems(report: LighthouseReport, baseline: LhScores | null): LhProblems {
  const drops = LH_CATEGORIES.flatMap((category) => {
    const before = baseline?.[category];
    const now = report.scores[category];
    return before !== undefined && now !== undefined && now <= before - LH_DROP ? [{ category, before, now }] : [];
  });
  const links = report.brokenLinks;
  return { names: [...drops.map((d) => d.category), ...links.map((l) => l.url)], drops, links };
}

export const readBaseline = (raw: unknown): LhScores | null => (raw && typeof raw === "object" ? parseLighthouseReport({ scores: raw }).scores : null);
