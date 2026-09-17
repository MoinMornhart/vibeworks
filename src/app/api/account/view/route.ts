import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { json, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { readUiPrefs, UI_KEYS } from "@/lib/uiPrefsLogic";

// Ansicht aufräumen (#109): welche Bereiche dieses Konto ausblendet.

const schema = z.object({ hidden: z.array(z.string().max(60)).max(UI_KEYS.length) });

export const GET = route(async () => {
  const user = await requireApiUser();
  const row = await db.user.findUnique({ where: { id: user.id }, select: { ui: true } });
  return json({ view: readUiPrefs(row?.ui) });
});

export const PUT = route(async (req) => {
  const user = await requireApiUser();
  const input = await readBody(req, schema, { maxBytes: 8000 });
  const prefs = readUiPrefs(input);
  await db.user.update({ where: { id: user.id }, data: { ui: prefs as unknown as Prisma.InputJsonValue } });
  return json({ view: prefs });
});
