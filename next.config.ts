import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // Die übrigen Sicherheits-Header (inkl. CSP mit Nonce) setzt die Middleware,
  // weil die Nonce je Anfrage neu erzeugt werden muss.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
        ],
      },
    ];
  },
  experimental: {
    // Hintergrundbilder werden über eine Server Action bzw. Route hochgeladen.
    serverActions: { bodySizeLimit: "8mb" },
  },
};

export default nextConfig;
