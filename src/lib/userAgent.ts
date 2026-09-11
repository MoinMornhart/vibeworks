// Grobe Einordnung eines User-Agents für die Sitzungsliste – genug, um
// „Edge auf Windows“ von „Safari auf iOS“ zu unterscheiden. Bewusst ohne
// Bibliothek: exakte Versionsnummern braucht hier niemand.

export interface DeviceInfo {
  /** Leer, wenn kein User-Agent vorliegt – die Oberfläche zeigt dann „Unbekannter Browser“ in ihrer Sprache. */
  browser: string;
  os: string;
  mobile: boolean;
}

export function describeUserAgent(ua: string | null | undefined): DeviceInfo {
  if (!ua) return { browser: "", os: "", mobile: false };
  const browser = /Edg(e|A|iOS)?\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /Firefox\/|FxiOS/.test(ua)
        ? "Firefox"
        : /Chrome\/|CriOS/.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : /curl\//i.test(ua)
              ? "curl"
              : "Browser";
  const os = /Windows/.test(ua)
    ? "Windows"
    : /Android/.test(ua)
      ? "Android"
      : /iPhone|iPad|iPod/.test(ua)
        ? "iOS"
        : /Mac OS X|Macintosh/.test(ua)
          ? "macOS"
          : /CrOS/.test(ua)
            ? "ChromeOS"
            : /Linux/.test(ua)
              ? "Linux"
              : "";
  return { browser, os, mobile: /Mobile|Android|iPhone|iPad/.test(ua) };
}
