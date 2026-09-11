// Benachrichtigungen ohne Netz und Datenbank: Anlässe, ntfy-Anfrage und
// Webhook-Nutzlast – im Browser und in Tests nutzbar.

export const NOTIFY_EVENTS = ["taskDue", "accessRequest", "issueClosed", "ciFailed", "siteDown", "renewal", "updated"] as const;
export type NotifyEvent = (typeof NOTIFY_EVENTS)[number];
export type EventSwitches = Record<NotifyEvent, boolean>;

export const CHANNELS = ["ntfy", "webhook", "email"] as const;
export type Channel = (typeof CHANNELS)[number];

export interface Notice {
  event: NotifyEvent | "test";
  title: string;
  message: string;
  url: string | null;
  priority?: "high" | "default";
}

/** Gespeicherte Schalter lesen – fehlt ein Anlass, ist er eingeschaltet. */
export function eventsOf(json: unknown): EventSwitches {
  const o = (json && typeof json === "object" ? json : {}) as Record<string, unknown>;
  return Object.fromEntries(NOTIFY_EVENTS.map((e) => [e, o[e] !== false])) as EventSwitches;
}

export function parseNtfyUrl(url: string): { server: string; topic: string } | null {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    const topic = u.pathname.replace(/^\/+|\/+$/g, "");
    if (!/^[\w-]{1,64}$/.test(topic)) return null;
    return { server: u.origin, topic };
  } catch {
    return null;
  }
}

const TAGS: Record<Notice["event"], string> = {
  taskDue: "calendar",
  accessRequest: "raising_hand",
  issueClosed: "white_check_mark",
  ciFailed: "x",
  siteDown: "rotating_light",
  renewal: "moneybag",
  updated: "rocket",
  test: "wave",
};

/**
 * ntfy per JSON veröffentlichen (an die Server-Adresse, Thema im Körper) –
 * so kommen Umlaute in Titel und Text sicher an.
 */
export function ntfyRequest(ntfyUrl: string, n: Notice, token: string | null) {
  const parsed = parseNtfyUrl(ntfyUrl);
  if (!parsed) return null;
  return {
    url: parsed.server,
    headers: (token ? { Authorization: `Bearer ${token}` } : {}) as Record<string, string>,
    body: {
      topic: parsed.topic,
      title: n.title,
      message: n.message,
      priority: n.priority === "high" ? 4 : 3,
      tags: [TAGS[n.event]],
      ...(n.url ? { click: n.url } : {}),
    },
  };
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

/** Discord und Slack bekommen ihr Format, alle anderen ein schlichtes JSON. */
export function webhookBody(url: string, n: Notice): Record<string, unknown> {
  const host = hostOf(url);
  if (host === "discord.com" || host === "discordapp.com" || host.endsWith(".discord.com")) {
    return { username: "VibeWorks", content: [`**${n.title}**`, n.message, n.url].filter(Boolean).join("\n").slice(0, 1900) };
  }
  if (host === "hooks.slack.com") {
    return { text: [`*${n.title}*`, n.message, n.url ? `<${n.url}>` : null].filter(Boolean).join("\n") };
  }
  return { app: "VibeWorks", event: n.event, title: n.title, message: n.message, url: n.url, at: new Date().toISOString() };
}

/** "kanal|meldung" → Teile (so steht der letzte Fehler in der Datenbank). */
export function splitLastError(value: string | null): { channel: Channel | null; error: string } | null {
  if (!value) return null;
  const [channel, ...rest] = value.split("|");
  return (CHANNELS as readonly string[]).includes(channel) ? { channel: channel as Channel, error: rest.join("|") } : { channel: null, error: value };
}
