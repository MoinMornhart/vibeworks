import { NextResponse, type NextRequest } from "next/server";

// Die Middleware läuft im Edge-Runtime ohne Datenbank. Sie setzt die
// Content-Security-Policy mit einer Nonce je Anfrage.

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
