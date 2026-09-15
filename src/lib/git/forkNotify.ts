import { db } from "@/lib/db";
import { appLink, notifyUser } from "@/lib/notify";

// Fork-Meldung (#23): jemand forkt ein Repository eines Projekts → der
// Besitzer erfährt es. Nichts wird kopiert oder ins eigene Repository
// geholt – Änderungen aus einem Fork kämen nur als Pull Request.

export interface ForkInfo {
  fullName: string;
  url: string;
  owner: string;
  private: boolean;
}

/** Fork aus der Webhook-Nutzlast (GitHub und Gitea/Forgejo: „forkee“) – null, wenn unlesbar. */
export function parseFork(raw: string): ForkInfo | null {
  try {
    const p = JSON.parse(raw) as { forkee?: { full_name?: unknown; html_url?: unknown; private?: unknown; owner?: { login?: unknown; username?: unknown } } };
    const f = p.forkee;
    if (!f || typeof f.full_name !== "string" || typeof f.html_url !== "string" || !/^https?:\/\//.test(f.html_url)) return null;
    const owner = typeof f.owner?.login === "string" ? f.owner.login : typeof f.owner?.username === "string" ? f.owner.username : f.full_name.split("/")[0];
    return { fullName: f.full_name.slice(0, 200), url: f.html_url.slice(0, 500), owner: String(owner).slice(0, 100), private: f.private === true };
  } catch {
    return null;
  }
}

/** Besitzer benachrichtigen. Der Link führt ins Projekt (die Glocke öffnet nur Seiten dieser Instanz), die Fork-Adresse steht im Text. */
export async function notifyFork(projectId: string, fork: ForkInfo): Promise<void> {
  try {
    const project = await db.project.findUnique({ where: { id: projectId }, select: { ownerId: true, name: true } });
    if (!project) return;
    await notifyUser(project.ownerId, "fork", (t) => ({
      event: "fork",
      title: t("events.fork.title", { project: project.name }),
      message: t(fork.private ? "events.fork.messagePrivate" : "events.fork.message", { owner: fork.owner, fork: fork.url }),
      url: appLink(`/projects/${projectId}`),
    }));
  } catch (err) {
    console.error("[fork]", err);
  }
}
