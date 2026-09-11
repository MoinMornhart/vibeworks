"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Lightbulb, ListChecks, Zap } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { FormError } from "@/components/ui/FormError";
import { Segmented } from "@/components/theme/controls";
import type { ProjectListItem } from "@/lib/projects";
import { api, errorMessage } from "@/lib/client/api";
import { useT } from "@/lib/i18n/client";

export const OPEN_CAPTURE_EVENT = "vw:capture";
const LAST_PROJECT_KEY = "vw.capture.project";
// Sammelziele im Projektfeld: dieselbe Aufgabe in allen (oder allen Git-)Projekten
const ALL = "__all__";
const ALL_GIT = "__git__";

/**
 * Das Formular der Schnellerfassung – im Dialog der Web-App und in der
 * Windows-App (/capture). Ein Feld, Enter, fertig: danach bleibt es offen und
 * leert nur das Feld – wer eine Idee notiert, hat oft gleich die nächste.
 */
export function CaptureForm({
  active,
  reloadKey = 0,
  hint,
  onLinkClick,
}: {
  active: boolean;
  /** Erhöhen, um Projekte neu zu laden und die Liste zu leeren (Windows-App beim Einblenden) */
  reloadKey?: number;
  hint?: string;
  onLinkClick?: (href: string, e: React.MouseEvent) => void;
}) {
  const t = useT("shell");
  const tc = useT("common");
  const router = useRouter();
  const [mode, setMode] = useState<"idea" | "task">("idea");
  const [text, setText] = useState("");
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [projectId, setProjectId] = useState("");
  const [created, setCreated] = useState<Array<{ key: string; label: string; href: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!active) return;
    setCreated([]);
    setError(null);
    inputRef.current?.focus();
    api<{ projects: ProjectListItem[] }>("/api/projects")
      .then((r) => {
        setProjects(r.projects);
        let last = "";
        try {
          last = localStorage.getItem(LAST_PROJECT_KEY) ?? "";
        } catch {
          /* egal */
        }
        const valid = r.projects.some((p) => p.id === last) || (last === ALL && r.projects.length > 0) || (last === ALL_GIT && r.projects.some((p) => p.repoUrl));
        setProjectId(valid ? last : (r.projects[0]?.id ?? ""));
      })
      .catch(() => {});
  }, [active, reloadKey]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === "idea") {
        const res = await api<{ project: ProjectListItem }>("/api/projects", { body: { name: value, status: "IDEA" } });
        setCreated((c) => [{ key: res.project.id, label: t("capture.createdIdea", { name: res.project.name }), href: `/projects/${res.project.id}` }, ...c].slice(0, 5));
      } else {
        if (!projectId) throw new Error(t("capture.pickProject"));
        if (projectId === ALL || projectId === ALL_GIT) {
          const ids = projects.filter((p) => projectId === ALL || p.repoUrl).map((p) => p.id);
          const res = await api<{ created: Array<{ id: string }> }>("/api/tasks/bulk", { body: { title: value, projectIds: ids } });
          const key = res.created[0]?.id ?? `${Date.now()}`;
          setCreated((c) => [{ key, label: t("capture.createdTaskMany", { title: value, n: res.created.length }), href: "/tasks" }, ...c].slice(0, 5));
        } else {
          const res = await api<{ task: { id: string; title: string } }>(`/api/projects/${projectId}/tasks`, { body: { title: value } });
          const project = projects.find((p) => p.id === projectId);
          setCreated((c) => [{ key: res.task.id, label: t("capture.createdTask", { title: res.task.title, project: project?.name ?? t("capture.project") }), href: `/projects/${projectId}` }, ...c].slice(0, 5));
        }
        try {
          localStorage.setItem(LAST_PROJECT_KEY, projectId);
        } catch {
          /* egal */
        }
      }
      setText("");
      router.refresh();
      inputRef.current?.focus();
    } catch (err) {
      setError(err instanceof Error && !("status" in err) ? err.message : errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Segmented
        label={t("capture.modeLabel")}
        value={mode}
        onChange={setMode}
        options={[
          { value: "idea", label: t("capture.idea"), icon: <Lightbulb size={14} /> },
          { value: "task", label: t("capture.task"), icon: <ListChecks size={14} /> },
        ]}
      />
      {mode === "task" && (
        <select className="field" value={projectId} onChange={(e) => setProjectId(e.target.value)} aria-label={t("capture.project")}>
          {projects.length === 0 && <option value="">{t("capture.noProjects")}</option>}
          {projects.length > 1 && <option value={ALL}>{t("capture.allProjects", { n: projects.length })}</option>}
          {projects.filter((p) => p.repoUrl).length > 1 && (
            <option value={ALL_GIT}>{t("capture.allGit", { n: projects.filter((p) => p.repoUrl).length })}</option>
          )}
          {projects.length > 1 && <option disabled>──────────</option>}
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      )}
      <input
        ref={inputRef}
        className="field text-base"
        placeholder={mode === "idea" ? t("capture.ideaPlaceholder") : t("capture.taskPlaceholder")}
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={mode === "idea" ? 120 : 200}
        autoFocus
        aria-label={mode === "idea" ? t("capture.idea") : t("capture.task")}
      />
      <FormError message={error} />
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted">{hint ?? t("capture.hint")}</span>
        <button className="btn btn-primary btn-sm" disabled={busy || !text.trim()}><Zap size={14} /> {tc("create")}</button>
      </div>
      {created.length > 0 && (
        <ul className="space-y-1 border-t pt-3">
          {created.map((c) => (
            <li key={c.key} className="flex items-center gap-2 text-sm">
              <Check size={14} className="shrink-0 text-emerald-400" />
              <Link href={c.href} className="truncate hover:text-accent-ink" onClick={(e) => onLinkClick?.(c.href, e)}>{c.label}</Link>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}

export function QuickCapture() {
  const t = useT("shell");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_CAPTURE_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_CAPTURE_EVENT, onOpen);
  }, []);

  return (
    <Modal open={open} onClose={() => setOpen(false)} title={<span className="flex items-center gap-2"><Zap size={18} className="text-accent-ink" /> {t("capture.title")}</span>}>
      <CaptureForm active={open} onLinkClick={() => setOpen(false)} />
    </Modal>
  );
}
