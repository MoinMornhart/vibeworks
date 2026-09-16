import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { ApiError, json, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { requireProject } from "@/lib/access";
import { hidesEverything, normalizeBoard } from "@/lib/boardConfig";
import { tk } from "@/lib/i18n/messages";

type Params = { id: string };

const schema = z.object({
  board: z.object({
    order: z.array(z.string().max(20)).max(12),
    hidden: z.array(z.string().max(20)).max(12),
    labels: z.record(z.string().max(20), z.string().max(200)).optional(),
    collapseAfter: z.number().int().min(0).max(100),
    aiLocked: z.array(z.string().max(20)).max(12).optional(),
    extra: z.array(z.object({ key: z.string().max(4), label: z.string().max(200), base: z.string().max(20) })).max(6).optional(),
  }),
});

// Aufgabenbrett einstellen: Namen, Reihenfolge, Sichtbarkeit der Spalten, Einklappen.
// Gilt für alle im Projekt – deshalb mit dem Recht „Projektangaben ändern“.
export const PATCH = route<Params>(async (req, { params }) => {
  const user = await requireApiUser();
  const { id } = await params;
  await requireProject(user.id, id, "project.edit");
  const { board } = await readBody(req, schema, { maxBytes: 4096 });
  if (hidesEverything(board)) throw new ApiError(400, tk("tasks", "board.settings.lastVisible"));
  const clean = normalizeBoard(board);
  await db.project.update({ where: { id }, data: { boardConfig: clean as unknown as Prisma.InputJsonValue } });
  // Entfernte Zusatz-Spalten (#76): Aufgaben zurück in ihre Grundspalte
  await db.task.updateMany({ where: { projectId: id, column: { not: null, notIn: clean.extra.map((x) => x.key) } }, data: { column: null } });
  return json({ board: clean });
});
