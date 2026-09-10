import type { MetadataRoute } from "next";
import { config } from "@/lib/config";

export const dynamic = "force-dynamic";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: config.appName,
    short_name: config.appName,
    description: "Kontrollzentrum für deine Vibe-Coding-Projekte",
    start_url: "/",
    display: "standalone",
    background_color: "#06061a",
    theme_color: "#06061a",
    lang: "de",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
