"use client";

import { useEffect, useState } from "react";
import { FolderLock, Trash2 } from "lucide-react";
import { api, errorMessage } from "@/lib/client/api";
import { useFormat, useT } from "@/lib/i18n/client";
import { toast } from "@/components/ui/Toaster";

interface KeyRow {
  id: string;
  name: string;
  hint: string;
  user: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  paused: boolean;
  createdAt: string;
}

/** Projekt-Schlüssel mit Zugriff auf dieses Projekt (#106) – der Besitzer kann sie widerrufen. */
export function ProjectKeysPanel({ projectId }: { projectId: string }) {
  const t = useT("mcp");
  const f = useFormat();
  const [keys, setKeys] = useState<KeyRow[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ keys: KeyRow[] }>(`/api/projects/${projectId}/keys`)
      .then((r) => setKeys(r.keys))
      .catch(() => setKeys([]));
  }, [projectId]);

  async function revoke(k: KeyRow) {
    if (!window.confirm(t("projectKey.confirmRevoke", { key: k.name }))) return;
    setBusy(true);
    try {
      setKeys((await api<{ keys: KeyRow[] }>(`/api/projects/${projectId}/keys/${k.id}`, { method: "DELETE" })).keys);
      toast(t("projectKey.revoked"));
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  }

  // Ohne Schlüssel bleibt die Seite ruhig – das Panel erscheint erst, wenn es etwas zu entscheiden gibt
  if (!keys?.length) return null;
  return (
    <section id="ki-schluessel" className="glass scroll-mt-24 p-6 sm:p-8" aria-labelledby="project-keys-heading" data-testid="project-keys">
      <h2 id="project-keys-heading" className="mb-1 flex items-center gap-2 text-lg font-semibold">
        <FolderLock size={18} className="text-accent-ink" /> {t("projectKey.panelTitle")}
      </h2>
      <p className="mb-3 text-sm text-muted">{t("projectKey.panelHint")}</p>
      <ul className="space-y-2">
        {keys.map((k) => (
          <li key={k.id} className="flex flex-wrap items-center gap-3 rounded-xl border px-3 py-2 text-sm" data-testid="project-key-row">
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {k.name} <span className="text-xs font-normal text-muted">{t("projectKey.by", { name: k.user })}</span>
                {k.paused && <span className="ml-2 text-xs text-amber-400">{t("projectKey.state.paused")}</span>}
              </p>
              <p className="text-xs text-muted" suppressHydrationWarning>
                <span className="font-mono">{k.hint}</span> · {k.lastUsedAt ? t("lastUsed", { ago: f.ago(k.lastUsedAt) }) : t("neverUsed")}
                {k.expiresAt && ` · ${t("projectKey.expires", { when: f.dateTime(k.expiresAt) })}`}
              </p>
            </div>
            <button type="button" className="btn btn-sm hover:text-red-400" disabled={busy} onClick={() => void revoke(k)} data-testid="project-key-revoke">
              <Trash2 size={13} /> {t("projectKey.revoke")}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
