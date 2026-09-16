import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { json, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { onboardingFor, readPrefs } from "@/lib/onboarding";

// Onboarding-Liste (#100): Erledigtes ausblenden oder die Liste ganz schließen – je Konto.
const schema = z.object({ hideDone: z.boolean().optional(), dismissed: z.boolean().optional() });

export const PATCH = route(async (req) => {
  const user = await requireApiUser();
  const input = await readBody(req, schema, { maxBytes: 512 });
  const current = await db.user.findUnique({ where: { id: user.id }, select: { onboarding: true } });
  const next = { ...readPrefs(current?.onboarding), ...input };
  await db.user.update({ where: { id: user.id }, data: { onboarding: next as unknown as Prisma.InputJsonValue } });
  return json({ onboarding: await onboardingFor(user.id) });
});
