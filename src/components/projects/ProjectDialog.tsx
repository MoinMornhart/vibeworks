"use client";

import { useEffect, useState } from "react";
import type { ProjectStatus } from "@prisma/client";
import { Save, Star, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { FormError } from "@/components/ui/FormError";
import { Segmented, Slider } from "@/components/theme/controls";
import type { ProjectListItem } from "@/lib/projects";
import { PRIORITIES, PROJECT_ACCENTS, PROJECT_STATUSES } from "@/lib/status";
import { api, ApiClientError, errorMessage } from "@/lib/client/api";
import { cn } from "@/lib/utils";

interface Form {
  name: string;
  summary: string;
  description: string;
  status: ProjectStatus;
  priority: number;
  progress: number;
  accent: string;
  tags: string;
  favorite: boolean;
  repoUrl: string;
}

function toForm(p?: ProjectListItem | null): Form {
  return {
    name: p?.name ?? "",
    summary: p?.summary ?? "",
    description: p?.description ?? "",
    status: p?.status ?? "IDEA",
    priority: p?.priority ?? 2,
    progress: p?.progress ?? 0,
    accent: p?.accent ?? "violet",
    tags: p?.tags.join(", ") ?? "",
    favorite: p?.favorite ?? false,
    repoUrl: p?.repoUrl ?? "",
  };
}

export function ProjectDialog({
  open,
  project,
  onClose,
  onSaved,
  onDeleted,
}: {
  open: boolean;
  project?: ProjectListItem | null;
  onClose: () => void;
  onSaved: (p: ProjectListItem) => void;
  onDeleted?: (id: string) => void;
}) {
  const editing = Boolean(project);
  const [form, setForm] = useState<Form>(() => toForm(project));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(toForm(project));
    setError(null);
    setFieldErrors({});
    // Auf dem Board fehlt die ausführliche Beschreibung – nachladen.
    if (project && project.description === undefined) {
      setLoadingDetails(true);
      api<{ project: ProjectListItem }>(`/api/projects/${project.id}`)
        .then((res) => setForm((f) => ({ ...f, description: res.project.description ?? "" })))
        .catch(() => {})
        .finally(() => setLoadingDetails(false));
    }
  }, [open, project]);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      const body = { ...form };
      const res = project
        ? await api<{ project: ProjectListItem }>(`/api/projects/${project.id}`, { method: "PATCH", body })
        : await api<{ project: ProjectListItem }>("/api/projects", { body });
      onSaved(res.project);
      onClose();
    } catch (err) {
      if (err instanceof ApiClientError) setFieldErrors(err.fieldErrors);
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!project || !window.confirm(`„${project.name}“ mit allen Notizen und Aufgaben endgültig löschen?`)) return;
    setBusy(true);
    try {
      await api(`/api/projects/${project.id}`, { method: "DELETE" });
      onDeleted?.(project.id);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Projekt bearbeiten" : "Neues Projekt"}
      size="lg"
      footer={
        <>
          {editing && (
            <button type="button" className="btn btn-danger btn-sm mr-auto" onClick={remove} disabled={busy}>
              <Trash2 size={14} /> Löschen
            </button>
          )}
          <button type="button" className="btn btn-sm" onClick={onClose}>Abbrechen</button>
          <button type="submit" form="project-form" className="btn btn-primary btn-sm" disabled={busy}>
            <Save size={14} /> {busy ? "Speichere …" : editing ? "Speichern" : "Anlegen"}
          </button>
        </>
      }
    >
      <form id="project-form" onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="p-name">Name</label>
          <input id="p-name" className="field" value={form.name} onChange={(e) => set("name", e.target.value)} required maxLength={120} autoFocus placeholder="Eine Idee genügt – alles andere später" />
          {fieldErrors.name && <p className="mt-1 text-xs text-red-400">{fieldErrors.name}</p>}
        </div>
        <div>
          <label className="label" htmlFor="p-summary">Kurzbeschreibung</label>
          <input id="p-summary" className="field" value={form.summary} onChange={(e) => set("summary", e.target.value)} maxLength={240} placeholder="Ein Satz für die Karte" />
        </div>
        <div>
          <label className="label" htmlFor="p-desc">Beschreibung {loadingDetails && <span className="opacity-70">(lädt …)</span>}</label>
          <textarea id="p-desc" className="field min-h-32" value={form.description} onChange={(e) => set("description", e.target.value)} maxLength={20000} placeholder="Ideenskizze, Ziele, offene Fragen … (Markdown möglich)" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="p-status">Status</label>
            <select id="p-status" className="field" value={form.status} onChange={(e) => set("status", e.target.value as ProjectStatus)}>
              {PROJECT_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label} – {s.hint}</option>
              ))}
            </select>
          </div>
          <div>
            <span className="label">Priorität</span>
            <Segmented
              label="Priorität"
              value={String(form.priority)}
              onChange={(v) => set("priority", Number(v))}
              options={PRIORITIES.map((p) => ({ value: String(p.value), label: p.label }))}
            />
          </div>
        </div>

        <Slider label="Fortschritt" value={form.progress} min={0} max={100} step={5} unit=" %" onChange={(v) => set("progress", v)} />

        <div>
          <span className="label">Akzentfarbe</span>
          <div className="flex flex-wrap gap-2">
            {Object.entries(PROJECT_ACCENTS).map(([key, a]) => (
              <button
                key={key}
                type="button"
                onClick={() => set("accent", key)}
                aria-pressed={form.accent === key}
                aria-label={a.label}
                title={a.label}
                className={cn("h-8 w-8 rounded-full border-2 transition hover:scale-110", form.accent === key ? "border-fg" : "border-transparent")}
                style={{ background: `linear-gradient(135deg, ${a.from}, ${a.to})` }}
              />
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="p-tags">Tags</label>
            <input id="p-tags" className="field" value={form.tags} onChange={(e) => set("tags", e.target.value)} placeholder="nextjs, ki, spiel" />
            <p className="mt-1 text-xs text-muted">Kommagetrennt, bis zu 12</p>
          </div>
          <div>
            <label className="label" htmlFor="p-repo">Repository</label>
            <input id="p-repo" className="field" value={form.repoUrl} onChange={(e) => set("repoUrl", e.target.value)} placeholder="https://github.com/…" />
            {fieldErrors.repoUrl && <p className="mt-1 text-xs text-red-400">{fieldErrors.repoUrl}</p>}
          </div>
        </div>

        <button type="button" onClick={() => set("favorite", !form.favorite)} aria-pressed={form.favorite} className="btn btn-sm">
          <Star size={15} className={form.favorite ? "fill-amber-400 text-amber-400" : ""} /> {form.favorite ? "Favorit" : "Als Favorit markieren"}
        </button>

        <FormError message={error} />
      </form>
    </Modal>
  );
}
