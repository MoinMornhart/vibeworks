import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ApiError, json, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { profileSchema } from "@/lib/validation";

export const PATCH = route(async (req) => {
  const user = await requireApiUser();
  const input = await readBody(req, profileSchema);
  try {
    const updated = await db.user.update({
      where: { id: user.id },
      data: {
        ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
      },
      select: { username: true, displayName: true, email: true },
    });
    return json({ profile: updated });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new ApiError(409, "Diese E-Mail-Adresse wird bereits von einem anderen Konto verwendet.", { email: "Vergeben" });
    }
    throw err;
  }
});
