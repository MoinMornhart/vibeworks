import { db } from "@/lib/db";
import { ApiError, json, readBody, route } from "@/lib/api";
import { requireApiAdmin } from "@/lib/auth/guard";
import { getSettings } from "@/lib/settings";
import { adminSettingsSchema } from "@/lib/validation";

function view(s: Awaited<ReturnType<typeof getSettings>>) {
  return { mode: s.mode, allowRegistration: s.allowRegistration, taskColumnLimit: s.taskColumnLimit };
}

export const GET = route(async () => {
  await requireApiAdmin();
  return json({ settings: view(await getSettings()) });
});

export const PATCH = route(async (req) => {
  await requireApiAdmin();
  const input = await readBody(req, adminSettingsSchema);
  const current = await getSettings();
  const mode = input.mode ?? current.mode;

  // Einzelbetrieb heißt genau ein Konto – sonst würden Konten ausgesperrt.
  if (mode === "SINGLE" && current.mode !== "SINGLE" && (await db.user.count()) > 1) {
    throw new ApiError(409, "Im Einzelbetrieb gibt es genau ein Konto. Bitte zuerst die übrigen Konten löschen.");
  }

  const updated = await db.settings.update({
    where: { id: "instance" },
    data: {
      mode,
      // Registrierung ergibt nur im Mehrbenutzerbetrieb Sinn.
      allowRegistration: mode === "MULTI" ? (input.allowRegistration ?? current.allowRegistration) : false,
      ...(input.taskColumnLimit !== undefined ? { taskColumnLimit: input.taskColumnLimit } : {}),
    },
  });
  return json({ settings: view(updated) });
});
