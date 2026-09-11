"use client";

import { useEffect, useState } from "react";
import { Ghost } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { FormError } from "@/components/ui/FormError";
import { api, errorMessage } from "@/lib/client/api";
import { useT } from "@/lib/i18n/client";
import { CAUSES, type Cause } from "@/lib/grave";
import { cn } from "@/lib/utils";

/** Begraben: Todesursache und letzte Worte – nichts wird gelöscht. */
export function BuryDialog({ project, onClose, onBuried }: { project: { id: string; name: string } | null; onClose: () => void; onBuried: (id: string) => void }) {
  const t = useT("grave");
  const [cause, setCause] = useState<Cause>("time");
  const [epitaph, setEpitaph] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!project) return;
    setCause("time");
    setEpitaph("");
    setError(null);
  }, [project]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!project) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/projects/${project.id}/grave`, { body: { action: "bury", cause, epitaph } });
      onBuried(project.id);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={project !== null} onClose={onClose} title={<span className="flex items-center gap-2"><Ghost size={18} className="text-accent-ink" /> {t("bury.title", { name: project?.name ?? "" })}</span>}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-muted">{t("bury.text")}</p>
        <fieldset>
          <legend className="label">{t("bury.cause")}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {CAUSES.map((c) => (
              <label key={c} className={cn("chip cursor-pointer justify-start !py-2", cause === c && "chip-active")}>
                <input type="radio" name="cause" value={c} checked={cause === c} onChange={() => setCause(c)} className="sr-only" />
                {t(`causes.${c}`)}
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <label className="label" htmlFor="grave-epitaph">{t("bury.epitaph")}</label>
          <textarea id="grave-epitaph" className="field min-h-20" maxLength={200} value={epitaph} onChange={(e) => setEpitaph(e.target.value)} placeholder={t("bury.epitaphPlaceholder")} />
        </div>
        <FormError message={error} />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn" onClick={onClose}>{t("bury.cancel")}</button>
          <button className="btn btn-primary" disabled={busy}><Ghost size={15} /> {t("bury.submit")}</button>
        </div>
      </form>
    </Modal>
  );
}
