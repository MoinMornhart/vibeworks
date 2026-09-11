import { parseNtfyUrl } from "./notify/format";

// Ideen-Eingang ohne Datenbank: Eingeworfenes zerlegen, ntfy-Antworten lesen.

export const INBOX_SOURCES = ["share", "webhook", "ntfy", "manual"] as const;
export type InboxSource = (typeof INBOX_SOURCES)[number];
export const MAX_INBOX_TEXT = 4000;
export const MAX_INBOX_ITEMS = 500;

/** Erste Zeile wird zum Namen (höchstens 120 Zeichen), der Rest zur Beschreibung. */
export function splitIdea(text: string, url: string | null = null): { name: string; description: string | null } {
  const clean = text.trim();
  const [first, ...rest] = clean.split(/\r?\n/);
  let name = (first ?? "").trim();
  let extra = rest.join("\n").trim();
  if (name.length > 120) {
    extra = `${name}\n${extra}`.trim();
    name = `${name.slice(0, 117).trimEnd()}…`;
  }
  const description = [extra, url].filter(Boolean).join("\n\n") || null;
  return { name: name || (url ?? "Idee"), description };
}

/** Aus Titel, Text und Link (z. B. vom „Teilen“-Menü) einen Eingangstext bauen. */
export function combineShared(parts: { title?: string | null; text?: string | null; url?: string | null }): { text: string; url: string | null } {
  let text = (parts.text ?? "").trim();
  let url = (parts.url ?? "").trim() || null;
  // Manche Apps packen den Link in den Text
  if (!url) {
    const m = text.match(/https?:\/\/\S+/);
    if (m) {
      url = m[0];
      text = text.replace(m[0], "").trim();
    }
  }
  const title = (parts.title ?? "").trim();
  const combined = [title, text].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join("\n");
  return { text: (combined || url || "").slice(0, MAX_INBOX_TEXT), url };
}

export function ntfyPollUrl(topicUrl: string, since: string | null): string | null {
  const parsed = parseNtfyUrl(topicUrl);
  if (!parsed) return null;
  return `${parsed.server}/${parsed.topic}/json?poll=1&since=${encodeURIComponent(since ?? "5m")}`;
}

export interface NtfyMessage {
  id: string;
  text: string;
  url: string | null;
}

/** ntfy liefert eine JSON-Zeile je Ereignis – nur echte Nachrichten zählen. */
export function parseNtfyLines(body: string): NtfyMessage[] {
  const out: NtfyMessage[] = [];
  for (const line of body.split("\n")) {
    if (!line.trim()) continue;
    try {
      const e = JSON.parse(line) as { id?: string; event?: string; message?: string; title?: string; click?: string };
      if (e.event !== "message" || !e.id) continue;
      const { text, url } = combineShared({ title: e.title, text: e.message, url: e.click });
      if (text) out.push({ id: e.id, text, url });
    } catch {
      /* kaputte Zeile überspringen */
    }
  }
  return out;
}
