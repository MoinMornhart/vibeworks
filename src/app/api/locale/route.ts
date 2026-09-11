import { z } from "zod";
import { db } from "@/lib/db";
import { json, readBody, route } from "@/lib/api";
import { config } from "@/lib/config";
import { currentUser } from "@/lib/auth/guard";
import { LOCALE_COOKIE, LOCALES } from "@/lib/i18n/config";

// Sprache wählen – auch ohne Anmeldung (Anmeldeseite). Angemeldet wird sie
// zusätzlich am Konto gespeichert und gilt dann auf allen Geräten.
export const PUT = route(async (req) => {
  const { locale } = await readBody(req, z.object({ locale: z.enum(LOCALES) }), { maxBytes: 256 });
  const user = await currentUser();
  if (user) await db.user.update({ where: { id: user.id }, data: { locale } });
  const res = json({ locale });
  res.cookies.set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", secure: config.secureCookies });
  return res;
});
