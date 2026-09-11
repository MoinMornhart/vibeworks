// Live-Überwachung ohne Netz und Datenbank: Zustandswechsel, SSL-Warnstufen,
// Vorschaubild aus dem HTML.

export type LiveState = "up" | "down";

/** Erst ab so vielen Fehlschlägen in Folge gilt eine Seite als offline – kurze Aussetzer lösen keinen Alarm aus. */
export const FAILS_FOR_DOWN = 2;

export function nextLiveState(prev: { state: LiveState | null; fails: number }, ok: boolean): { state: LiveState | null; fails: number; event: "down" | "up" | null } {
  if (ok) return { state: "up", fails: 0, event: prev.state === "down" ? "up" : null };
  const fails = prev.fails + 1;
  if (fails >= FAILS_FOR_DOWN) return { state: "down", fails, event: prev.state === "down" ? null : "down" };
  return { state: prev.state, fails, event: null };
}

/** SSL-Warnung: einmal bei 14 Tagen, noch einmal bei 3 – nach einer Verlängerung von vorn. */
export function sslStep(daysLeft: number, notified: string | null): { notify: boolean; notified: string | null } {
  if (daysLeft > 14) return { notify: false, notified: null };
  if (daysLeft <= 3) return notified === "3" ? { notify: false, notified } : { notify: true, notified: "3" };
  return notified ? { notify: false, notified } : { notify: true, notified: "14" };
}

const ATTR = /([a-zA-Z_:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(ATTR)) out[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? "";
  return out;
}

const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();

/** Vorschaubild der Seite: og:image, sonst twitter:image, sonst Apple-Touch- oder normales Icon. */
export function extractImage(html: string, baseUrl: string): string | null {
  const head = html.slice(0, 300_000);
  const metas = [...head.matchAll(/<meta\b[^>]*>/gi)].map((m) => attrs(m[0]));
  const links = [...head.matchAll(/<link\b[^>]*>/gi)].map((m) => attrs(m[0]));
  const meta = (...keys: string[]) => metas.find((a) => keys.includes((a.property ?? a.name ?? "").toLowerCase()) && a.content)?.content;
  const icon = (rel: string) => links.find((a) => (a.rel ?? "").toLowerCase().split(/\s+/).includes(rel) && a.href)?.href;
  const candidate =
    meta("og:image", "og:image:url", "og:image:secure_url") ?? meta("twitter:image", "twitter:image:src") ?? icon("apple-touch-icon") ?? icon("icon");
  if (!candidate) return null;
  try {
    const url = new URL(decode(candidate), baseUrl);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}
