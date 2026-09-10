import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ApiError, json, notFound, readBody, route } from "@/lib/api";
import { requireApiAdmin } from "@/lib/auth/guard";
import { isLastActiveAdmin, listUsers } from "@/lib/admin";
import { checkPasswordPolicy, hashPassword } from "@/lib/auth/password";
import { destroyAllSessions } from "@/lib/auth/session";
import { removeUploadFile } from "@/lib/uploads";
import { adminUserUpdateSchema } from "@/lib/validation";

type Params = { id: string };

export const PATCH = route<Params>(async (req, { params }) => {
  const me = await requireApiAdmin();
  const { id } = await params;
  const target = await db.user.findUnique({ where: { id } });
  if (!target) throw notFound("Konto nicht gefunden");
  const input = await readBody(req, adminUserUpdateSchema);

  const data: Prisma.UserUpdateInput = {};
  let endSessions = false;

  if (input.displayName !== undefined) data.displayName = input.displayName;

  if (input.role && input.role !== target.role) {
    if (input.role === "USER" && target.active && (await isLastActiveAdmin(id))) {
      throw new ApiError(400, "Der letzte aktive Administrator kann nicht herabgestuft werden.");
    }
    data.role = input.role;
  }

  if (input.active !== undefined && input.active !== target.active) {
    if (!input.active) {
      if (id === me.id) throw new ApiError(400, "Das eigene Konto kann nicht deaktiviert werden.");
      if (target.role === "ADMIN" && (await isLastActiveAdmin(id))) {
        throw new ApiError(400, "Der letzte aktive Administrator kann nicht deaktiviert werden.");
      }
      endSessions = true;
    }
    data.active = input.active;
  }

  if (input.password) {
    const policy = checkPasswordPolicy(input.password, target.username);
    if (policy) throw new ApiError(400, policy, { password: policy });
    data.passwordHash = await hashPassword(input.password);
    // Ein neu gesetztes Passwort beendet alle Sitzungen des Kontos sofort.
    endSessions = true;
  }

  if (input.unlock) {
    data.failedLogins = 0;
    data.lockedUntil = null;
  }

  await db.user.update({ where: { id }, data });
  if (endSessions) await destroyAllSessions(id);
  return json({ users: await listUsers() });
});

export const DELETE = route<Params>(async (_req, { params }) => {
  const me = await requireApiAdmin();
  const { id } = await params;
  if (id === me.id) throw new ApiError(400, "Das eigene Konto kann nicht gelöscht werden.");
  const target = await db.user.findUnique({ where: { id }, include: { uploads: { select: { id: true, ext: true } } } });
  if (!target) throw notFound("Konto nicht gefunden");
  if (target.role === "ADMIN" && target.active && (await isLastActiveAdmin(id))) {
    throw new ApiError(400, "Der letzte aktive Administrator kann nicht gelöscht werden.");
  }
  // Projekte, Notizen, Aufgaben und Sitzungen gehen per Cascade mit; die
  // hochgeladenen Bilder liegen außerhalb der Datenbank.
  await db.user.delete({ where: { id } });
  await Promise.all(target.uploads.map((u) => removeUploadFile(u.id, u.ext)));
  return json({ users: await listUsers() });
});
