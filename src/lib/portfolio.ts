import { db } from "./db";
import { config } from "./config";

// Öffentliches Portfolio: Einstellungen im Konto. Die Seite selbst liegt unter /u/<username>.

export async function portfolioView(userId: string) {
  const [user, projects] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: userId }, select: { username: true, portfolioPublic: true, portfolioBio: true } }),
    db.project.findMany({ where: { ownerId: userId, buriedAt: null }, select: { id: true, name: true, status: true, inPortfolio: true }, orderBy: { name: "asc" } }),
  ]);
  return { public: user.portfolioPublic, bio: user.portfolioBio ?? "", url: `${config.appUrl}/u/${user.username}`, projects };
}
export type PortfolioView = Awaited<ReturnType<typeof portfolioView>>;

/** Auswahl setzen – per SQL, damit „zuletzt geändert“ der Projekte nicht springt. */
export async function setPortfolio(userId: string, input: { public: boolean; bio: string | null; projectIds: string[] }) {
  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { portfolioPublic: input.public, portfolioBio: input.bio } }),
    db.$executeRaw`UPDATE "Project" SET "inPortfolio" = ("id" = ANY(${input.projectIds}::text[])) WHERE "ownerId" = ${userId}`,
  ]);
}
