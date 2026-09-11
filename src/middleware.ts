import { NextResponse, type NextRequest } from "next/server";

// Die Middleware läuft im Edge-Runtime ohne Datenbank. Sie setzt die
// Content-Security-Policy mit einer Nonce je Anfrage und leitet ohne
// Sitzungscookie zur Anmeldung um. Ob die Sitzung wirklich gültig ist,
// entscheidet erst der Server in jeder Seite und jedem Endpunkt.

const SESSION_COOKIES = ["__Host-vw_session", "vw_session"];
// /s/<token>: geteilte Projekte, auch ohne Anmeldung lesbar
// /api/mcp: Claude Code meldet sich per API-Schlüssel an, nicht per Cookie
const PUBLIC_PATHS = ["/login", "/setup", "/register", "/s", "/api/auth", "/api/health", "/api/locale", "/api/webhooks", "/api/mcp", "/api/inbox/in","/manifest.webmanifest"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function csp(nonce: string): string {
  const dev = process.env.NODE_ENV !== "production";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    // React setzt style-Attribute (Hintergrund-Einstellungen, Fortschrittsbalken).
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self'${dev ? " ws: wss:" : ""}`,
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
  ].join("; ");
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (!SESSION_COOKIES.some((n) => req.cookies.has(n)) && !isPublic(pathname)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname !== "/" ? `?next=${encodeURIComponent(pathname + search)}` : "";
    return NextResponse.redirect(url);
  }

  const nonce = btoa(crypto.randomUUID());
  const policy = csp(nonce);
  const headers = new Headers(req.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", policy);

  const res = NextResponse.next({ request: { headers } });
  res.headers.set("Content-Security-Policy", policy);
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png).*)"],
};
