import { access, constants, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "./config";

// Update per Knopfdruck. Die App läuft ohne Root-Rechte und führt selbst
// nichts aus: Sie legt nur eine Anfrage-Datei ab. Ein systemd-Wächter
// (vibeworks-control.path) startet daraufhin den update-Befehl als root, der
// Status und Log in ein Verzeichnis schreibt, das die App nur lesen darf.

export type UpdateAction = "check" | "update";

export interface UpdateStatus {
  action: UpdateAction;
  state: "running" | "done" | "failed" | "busy";
  message: string;
  startedAt: string;
  finishedAt: string | null;
  exitCode?: number;
  current?: { sha: string; version: string } | null;
  latest?: { sha: string; version: string; behind: number; commits: Array<{ sha: string; subject: string }> } | null;
}

/** Nur bei Installation per Installer/update-Befehl vorhanden. */
export async function selfUpdateAvailable(): Promise<boolean> {
  const dir = config.updateControlDir;
  if (!dir || !config.updateStatusDir) return false;
  try {
    await access(dir, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

export async function readUpdateStatus(): Promise<{ status: UpdateStatus | null; log: string[] }> {
  const dir = config.updateStatusDir;
  if (!dir) return { status: null, log: [] };
  let status: UpdateStatus | null = null;
  try {
    status = JSON.parse(await readFile(path.join(dir, "status.json"), "utf8"));
  } catch {
    /* noch kein Status */
  }
  let log: string[] = [];
  if (status?.action === "update") {
    try {
      const raw = await readFile(path.join(dir, "update.log"), "utf8");
      log = raw.replace(/\r/g, "").split("\n").filter(Boolean).slice(-60);
    } catch {
      /* kein Log */
    }
  }
  return { status, log };
}

export async function requestUpdate(action: UpdateAction): Promise<void> {
  const dir = config.updateControlDir;
  if (!dir) throw new Error("Update per Knopfdruck ist nicht eingerichtet.");
  await writeFile(path.join(dir, "request"), `${action}\n`, { mode: 0o640 });
}
