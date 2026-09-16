// Link-Prüfung (#65): Links aus Notizen, Docs und Community laufen über eine
// Hinweisseite. Die Prüfung ist rein lokal – kein fremder Dienst erfährt,
// was angeklickt wird – und bewertet nur, was an der Adresse selbst auffällt.

export const LINK_GUARD_COOKIE = "vw-link-guard";
export const REDIRECT_SECONDS = 5;

export type LinkWarning = "http" | "ip" | "punycode" | "unicode" | "shortener" | "credentials" | "port" | "lookalike" | "tld" | "subdomains";

export interface LinkCheck {
  kind: "internal" | "external" | "blocked";
  /** Normalisierte Adresse – leer bei „blocked“ */
  url: string;
  host: string;
  warnings: LinkWarning[];
}

const SHORTENERS = new Set(["bit.ly", "tinyurl.com", "t.co", "goo.gl", "is.gd", "ow.ly", "cutt.ly", "rb.gy", "buff.ly", "shorturl.at", "tiny.cc", "s.id", "lnkd.in"]);
const RISKY_TLDS = new Set(["zip", "mov", "top", "xyz", "click", "country", "gq", "tk", "ml", "cf", "work"]);
/** Marken, die gern nachgeahmt werden – mit ihren echten Domains */
const BRANDS: Record<string, string[]> = {
  github: ["github.com", "github.io", "githubusercontent.com"],
  gitlab: ["gitlab.com", "gitlab.io"],
  google: ["google.com", "google.de", "googleusercontent.com", "youtube.com"],
  microsoft: ["microsoft.com", "live.com", "office.com", "azure.com"],
  paypal: ["paypal.com", "paypal.de"],
  apple: ["apple.com", "icloud.com"],
  amazon: ["amazon.com", "amazon.de", "amazonaws.com"],
  anthropic: ["anthropic.com", "claude.ai"],
  discord: ["discord.com", "discord.gg"],
  steam: ["steampowered.com", "steamcommunity.com"],
};

const isIp = (host: string) => /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith("[") || /^[0-9a-f:]+$/i.test(host) && host.includes(":");
const endsWithDomain = (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`);

/** Adresse prüfen. appUrl: eigene Adresse – Links dorthin (auch relative) sind intern. */
export function checkLink(href: string, appUrl: string): LinkCheck {
  const raw = href.trim();
  const own = new URL(appUrl);
  let url: URL;
  try {
    url = new URL(raw, own);
  } catch {
    return { kind: "blocked", url: "", host: "", warnings: [] };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return { kind: "blocked", url: "", host: "", warnings: [] };
  if (url.origin === own.origin) return { kind: "internal", url: url.pathname + url.search + url.hash, host: url.host, warnings: [] };

  const host = url.hostname.toLowerCase();
  const warnings: LinkWarning[] = [];
  if (url.protocol === "http:") warnings.push("http");
  if (isIp(host)) warnings.push("ip");
  if (host.split(".").some((l) => l.startsWith("xn--"))) warnings.push("punycode");
  if (/[^\x00-\x7f]/.test(raw.split(/[/?#]/)[2] ?? "")) warnings.push("unicode");
  if (SHORTENERS.has(host)) warnings.push("shortener");
  if (url.username || url.password || /^[a-z]+:\/\/[^/]*@/i.test(raw)) warnings.push("credentials");
  if (url.port && !["80", "443", "8080", "8443"].includes(url.port)) warnings.push("port");
  if (RISKY_TLDS.has(host.split(".").pop() ?? "")) warnings.push("tld");
  if (host.split(".").length > 5) warnings.push("subdomains");
  for (const [brand, domains] of Object.entries(BRANDS)) {
    if (host.includes(brand) && !domains.some((d) => endsWithDomain(host, d))) {
      warnings.push("lookalike");
      break;
    }
  }
  return { kind: "external", url: url.href, host, warnings };
}

/** Wohin ein Link im Markdown zeigt: intern direkt, extern über die Hinweisseite. */
export function guardedHref(href: string, appUrl: string): string | null {
  const c = checkLink(href, appUrl);
  if (c.kind === "blocked") return null;
  if (c.kind === "internal") return c.url;
  return `/go?to=${encodeURIComponent(c.url)}`;
}

/** Darf die Hinweisseite ohne Klick weiterleiten? Nur bei unauffälligen Links, abgeschalteter Nachfrage und Klick aus VibeWorks. */
export function mayAutoContinue(check: LinkCheck, guardOff: boolean, cameFromApp: boolean): boolean {
  if (check.kind === "internal") return true;
  return check.kind === "external" && guardOff && cameFromApp && check.warnings.length === 0;
}
