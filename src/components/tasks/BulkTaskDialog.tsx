"use client";

import { useEffect, useMemo, useState } from "react";
import { GitBranch, ListPlus } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { FormError } from "@/components/ui/FormError";
import { accentGradient } from "@/components/projects/ProjectCard";
import type { TaskItem } from "@/lib/tasks";
import { api, ApiClientError, errorMessage } from "@/lib/client/api";
import { useT } from "@/lib/i18n/client";

export type BulkProject = { id: string; name: string; accent: string; repoUrl: string | null };
export type BulkCreated = TaskItem & { project: { id: string; name: string; accent: string } };

/** Eine Aufgabe für mehrere Projekte – vorausgewählt sind alle mit Git-Verbindung. */
export function BulkTaskDialog({
  open,
  projects,
  onClose,
  onCreated,
}: {
  open: boolean;
  projects: BulkProject[];
  onClose: () => void;
  onCreated: (created: BulkCreated[], skipped: number) => void;
}) {
  const t = useT("tasks");
  const gitIds = useMemo(() => projects.filter((p) => p.repoUrl).map((p) => p.id), [projects]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [labels, setLabels] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setSelected(new Set(gitIds));
    setError(null);
    setFieldErrors({});
  }, [open, gitIds]);

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      const res = await api<{ created: BulkCreated[]; skipped: number }>("/api/tasks/bulk", {
        body: { title, description, dueDate: dueDate || null, labels, projectIds: [...selected] },
      });
      onCreated(res.created, res.skipped);
      setTitle("");
      setDescription("");
      setDueDate("");
      setLabels("");
      onClose();
    } catch (err) {
      if (err instanceof ApiClientError) setFieldErrors(err.fieldErrors);
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={<span className="flex items-center gap-2"><ListPlus size={18} className="text-accent-ink" /> {t("overview.bulk.title")}</span>}
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="bulk-title">{t("overview.bulk.titleLabel")}</label>
          <input id="bulk-title" className="field" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} autoFocus placeholder={t("overview.bulk.titlePlaceholder")} />
          {fieldErrors.title && <p className="mt-1 text-xs text-red-400">{fieldErrors.title}</p>}
        </div>
        <div>
          <label className="label" htmlFor="bulk-desc">{t("overview.bulk.description")}</label>
          <textarea id="bulk-desc" className="field min-h-20" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={20_000} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="bulk-due">{t("overview.bulk.dueDate")}</label>
            <input id="bulk-due" type="date" className="field" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="bulk-labels">{t("overview.bulk.labels")}</label>
            <input id="bulk-labels" className="field" value={labels} onChange={(e) => setLabels(e.target.value)} placeholder="wartung, deps" />
          </div>
        </div>

        <fieldset>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <legend className="label !mb-0 mr-auto">{t("overview.bulk.projects", { n: selected.size })}</legend>
            <button type="button" className="chip" onClick={() => setSelected(new Set(gitIds))} disabled={!gitIds.length}>
              <GitBranch size={12} /> {t("overview.bulk.allGit", { n: gitIds.length })}
            </button>
            <button type="button" className="chip" onClick={() => setSelected(new Set(projects.map((p) => p.id)))}>{t("overview.bulk.all")}</button>
            <button type="button" className="chip" onClick={() => setSelected(new Set())}>{t("overview.bulk.none")}</button>
          </div>
          <ul className="max-h-64 space-y-1 overflow-y-auto rounded-xl border p-2">
            {projects.map((p) => (
              <li key={p.id}>
                <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-fg/5">
                  <input type="checkbox" className="h-4 w-4 accent-[var(--vw-accent)]" checked={selected.has(p.id)} onChange={() => toggle(p.id)} />
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: accentGradient(p.accent) }} />
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  {p.repoUrl && <GitBranch size={13} className="shrink-0 text-muted" aria-label={t("overview.bulk.git")} />}
                </label>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">{t("overview.bulk.issueHint")}</p>
        </fieldset>

        <FormError message={error} />
        <div className="flex justify-end">
          <button className="btn btn-primary" disabled={busy || !title.trim() || selected.size === 0}>
            <ListPlus size={15} /> {t("overview.bulk.submit", { n: selected.size })}
          </button>
        </div>
      </form>
    </Modal>
  );
}
