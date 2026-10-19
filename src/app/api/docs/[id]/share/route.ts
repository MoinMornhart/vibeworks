import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, json, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { requireDoc } from "@/lib/docs/access";
import { tk } from "@/lib/i18n/messages";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";

type Params = { id: string };

const roleSchema = z.enum(["VIEWER", "EDITOR"]);
const bodySchema = z.union([
  z.object({ action: z.literal("add"), username: z.string().trim().min(1).max(40), role: roleSchema }),
  z.object({ action: z.literal("role"), userId: z.string().max(40), role: roleSchema }),
  z.object({ action: z.literal("remove"), userId: z.string().max(40) }),
]);

/** Eingeladene Konten einer Leinwand/Seite – für die Teilen-Oberfläche. */
async function members(docId: string) {
  const rows = await db.docAccess.findMany({
    where: { docId },
    select: { userId: true, role: true, user: { select: { username: true, displayName: true } } },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r) => ({ userId: r.userId, role: r.role, username: r.user.username, displayName: r.user.displayName }));
}

// Mitglieder einer geteilten Leinwand/Seite ansehen – nur der Besitzer (#211).
export const GET = route<Params>(async (_req, { params }) => {
  const user = await requireApiUser();
  const { doc } = await requireDoc(user.id, (await params).id, "own");
  return json({ members: await members(doc.id) });
});

// Freigabe verwalten: Konto einladen, Rolle ändern, entfernen – nur der Besitzer.
export const POST = route<Params>(async (req, { params }) => {
  const user = await requireApiUser();
  limitOrThrow(`doc-share:${user.id}`, 30, 10 * MINUTE);
  const { doc } = await requireDoc(user.id, (await params).id, "own");
  const body = await readBody(req, bodySchema, { maxBytes: 512 });

  if (body.action === "add") {
    const target = await db.user.findFirst({ where: { username: body.username, active: true }, select: { id: true } });
    if (!target) throw new ApiError(404, tk("share", "errors.noAccount"), { username: tk("share", "errors.unknown") });
    if (target.id === doc.ownerId) throw new ApiError(400, tk("share", "errors.alreadyOwner"), { username: tk("share", "errors.thatsYou") });
    await db.docAccess.upsert({
      where: { docId_userId: { docId: doc.id, userId: target.id } },
      create: { docId: doc.id, userId: target.id, role: body.role },
      update: { role: body.role },
    });
  } else if (body.action === "role") {
    await db.docAccess.updateMany({ where: { docId: doc.id, userId: body.userId }, data: { role: body.role } });
  } else {
    await db.docAccess.deleteMany({ where: { docId: doc.id, userId: body.userId } });
  }

  // „ACCOUNTS“, solange jemand eingeladen ist – sonst wieder privat.
  const count = await db.docAccess.count({ where: { docId: doc.id } });
  await db.doc.update({ where: { id: doc.id }, data: { share: count > 0 ? "ACCOUNTS" : "PRIVATE" } });

  return json({ members: await members(doc.id) });
});
