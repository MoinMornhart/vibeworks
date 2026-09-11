import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { config } from "@/lib/config";
import { resolveTheme } from "@/lib/theme";
import { themeCss } from "@/lib/theme/css";
import { currentUser } from "@/lib/auth/guard";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { Background } from "@/components/background/Background";
import { getLocale, getT } from "@/lib/i18n/server";
import { I18nProvider } from "@/lib/i18n/client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("shell");
  return {
    title: { default: config.appName, template: `%s · ${config.appName}` },
    description: t("meta.description"),
    applicationName: config.appName,
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#06061a",
};

/** Persönliches Design des angemeldeten Kontos, sonst die Vorgabe. */
async function loadTheme() {
  try {
    return resolveTheme((await currentUser())?.theme);
  } catch {
    // Datenbank nicht erreichbar – die Seite soll trotzdem gestaltet erscheinen.
    return resolveTheme(null);
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const [theme, locale] = await Promise.all([loadTheme(), getLocale()]);

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <style id="vw-theme" nonce={nonce} dangerouslySetInnerHTML={{ __html: themeCss(theme) }} />
      </head>
      <body>
        <I18nProvider locale={locale}>
          <ThemeProvider initial={theme}>
            <Background />
            {children}
          </ThemeProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
