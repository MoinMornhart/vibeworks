import { z } from "zod";
import { cookies } from "next/headers";
import { json, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { ApiError } from "@/lib/api";
import { tk } from "@/lib/i18n/messages";
import { BETA_COOKIE } from "@/lib/betaLogic";

const schema = z.object({ on: z.boolean() });

// Beta-Ansicht (#68): einschalten nur für Admins, beenden darf jeder mit dem Cookie –
// wer ihn sich selbst setzt, sperrt sich nur die eigenen Änderungen.
export const POST = route(async (req) => {
  const user = await requireApiUser();
  const { on } = await readBody(req, schema, { maxBytes: 64 });
  const jar = await cookies();
  if (on) {
    if (user.role !== "ADMIN") throw new ApiError(403, tk("admin", "beta.adminOnly"));
    jar.set(BETA_COOKIE, "1", { httpOnly: true, sameSite: "lax", secure: req.nextUrl.protocol === "https:", path: "/", maxAge: 60 * 60 * 8 });
  } else {
    jar.delete(BETA_COOKIE);
  }
  return json({ on });
});
