"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import { api, errorMessage } from "@/lib/client/api";
import { FormError } from "@/components/ui/FormError";
import { useT } from "@/lib/i18n/client";

interface Mine {
  id: string;
  name: string;
  inCommunity: boolean;
}

/** Eigene Projekte für die Community auswählen. */
export function CommunityMine({ initial }: { initial: Mine[] }) {
  const t = useT("community");
  const [projects, setProjects] = useState(initial);
  const [chosen, setChosen] = useState(() => new Set(initial.filter((p) => p.inCommunity).map((p) => p.id)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const dirty = projects.some((p) => p.inCommunity !== chosen.has(p.id));

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await api<{ projects: Mine[] }>("/api/community/mine", { method: "PUT", body: { projectIds: [...chosen] } });
      setProjects(res.projects);
      setSaved(true);
      window.setTimeout(() => window.location.reload(), 600); // Übersicht oben neu laden
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="glass p-6 sm:p-8" aria-labelledby="community-mine">
      <h2 id="community-mine" className="text-lg font-semibold">{t("mine.title")}</h2>
      <p className="mb-4 mt-1 text-sm text-muted">{t("mine.hint")}</p>
      {projects.length === 0 ? (
        <p className="text-sm text-muted">{t("mine.empty")}</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" data-testid="community-mine">
          {projects.map((p) => (
            <li key={p.id}>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border bg-bg/25 px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[var(--vw-accent)]"
                  checked={chosen.has(p.id)}
                  onChange={(e) =>
                    setChosen((s) => {
                      const next = new Set(s);
                      if (e.target.checked) next.add(p.id);
                      else next.delete(p.id);
                      return next;
                    })
                  }
                />
                <span className="min-w-0 truncate">{p.name}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex items-center gap-3">
        <button type="button" className="btn btn-primary btn-sm" disabled={busy || !dirty} onClick={() => void save()}>
          <Save size={14} /> {t("mine.save")}
        </button>
        {saved && <span role="status" className="text-sm text-emerald-400">{t("mine.saved")}</span>}
      </div>
      <FormError message={error} />
    </section>
  );
}
