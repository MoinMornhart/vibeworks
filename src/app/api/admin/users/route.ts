import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ApiError, json, readBody, route } from "@/lib/api";
import { requireApiAdmin } from "@/lib/auth/guard";
import { listUsers } from "@/lib/admin";
import { getSettings } from "@/lib/settings";
import { checkPasswordPolicy, hashPassword } from "@/lib/auth/password";
import { adminUserCreateSchema } from "@/lib/validation";

export const GET = route(async () => {
  await requireApiAdmin();
  return json({ users: await listUsers() });
});

export const POST = route(async (req) => {
  await requireApiAdmin();
  if ((await getSettings()).mode !== "MULTI") {
    throw new ApiError(409, "Weitere Konten gibt es nur im Mehrbenutzerbetrieb.");
  }
  const input = await readBody(req, adminUserCreateSchema);
  const policy = checkPasswordPolicy(input.password, input.username);
  if (policy) throw new ApiError(400, policy, { password: policy });
  try {
    await db.user.create({
      data: { username: input.username, displayName: input.displayName, role: input.role, passwordHash: await hashPassword(input.password) },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new ApiError(409, "Dieser Benutzername ist vergeben.", { username: "Vergeben" });
    }
    throw err;
  }
  return json({ users: await listUsers() }, { status: 201 });
});
