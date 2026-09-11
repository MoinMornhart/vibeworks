import { after } from "next/server";
import { db } from "@/lib/db";
import { ApiError, json, notFound, route } from "@/lib/api";
import { decrypt } from "@/lib/crypto";
import { verifyWebhook } from "@/lib/git/webhook";
import { syncProjectNow } from "@/lib/git/scheduler";
import { tk } from "@/lib/i18n/messages";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";

type Params = { projectId: string };

const MAX_BODY = 2 * 1024 * 1024;

// Eingang für Webhooks von GitHub, GitLab und Gitea/Forgejo – ohne Anmeldung
// (siehe Middleware), geschützt durch die Signatur mit dem Projektgeheimnis.
// Die Antwort kommt sofort; der Abgleich läuft danach im Hintergrund.
export const POST = route<Params>(async (req, { params }) => {
  const { projectId } = await params;
  limitOrThrow(`webhook:${projectId}`, 120, MINUTE);
  const raw = await req.text();
  if (raw.length > MAX_BODY) throw new ApiError(413, "errors.tooLarge");

  const project = await db.project.findUnique({ where: { id: projectId }, select: { id: true, repoUrl: true, webhookSecretCipher: true } });
  if (!project?.webhookSecretCipher || !project.repoUrl) throw notFound();
  let secret: string;
  try {
    secret = decrypt(project.webhookSecretCipher);
  } catch {
    throw notFound();
  }

  const check = verifyWebhook(req.headers, raw, secret);
  if (!check.ok) throw new ApiError(401, tk("git", "webhook.errors.signature"));

  // Ohne updatedAt anzufassen – ein Webhook ist keine Änderung am Projekt.
  await db.$executeRaw`UPDATE "Project" SET "webhookAt" = NOW() WHERE "id" = ${project.id}`;
  if (check.event === "ping") return json({ ok: true, event: "ping" });
  after(() => syncProjectNow(project.id));
  return json({ ok: true, event: check.event }, { status: 202 });
});
