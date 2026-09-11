import type { MetadataRoute } from "next";
import { config } from "@/lib/config";
import { getLocale, getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const [locale, t] = await Promise.all([getLocale(), getT("shell")]);
  return {
    name: config.appName,
    short_name: config.appName,
    description: t("meta.description"),
    start_url: "/",
    display: "standalone",
    background_color: "#06061a",
    theme_color: "#06061a",
    lang: locale,
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
    // Installiert (Startbildschirm) erscheint VibeWorks im „Teilen“-Menü – Ziel ist der Ideen-Eingang
    share_target: { action: "/inbox/new", method: "get", params: { title: "title", text: "text", url: "url" } },
  };
}
