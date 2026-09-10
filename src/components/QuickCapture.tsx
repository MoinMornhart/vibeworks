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

export const OPEN_CAPTURE_EVENT = "vw:capture";
const LAST_PROJECT_KEY = "vw.capture.project";

// Schnellerfassung: ein Feld, Enter, fertig. Der Dialog bleibt offen und
// leert nur das Feld – wer eine Idee notiert, hat oft gleich die nächste.
export function QuickCapture() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"idea" | "task">("idea");
  const [text, setText] = useState("");
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [projectId, setProjectId] = useState("");
  const [created, setCreated] = useState<Array<{ key: string; label: string; href: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_CAPTURE_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_CAPTURE_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    setCreated([]);
    setError(null);
    api<{ projects: ProjectListItem[] }>("/api/projects")
      .then((r) => {
        setProjects(r.projects);
        let last = "";
        try {
          last = localStorage.getItem(LAST_PROJECT_KEY) ?? "";
        } catch {
          /* egal */
        }
        setProjectId(r.projects.some((p) => p.id === last) ? last : (r.projects[0]?.id ?? ""));
      })
      .catch(() => {});
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === "idea") {
        const res = await api<{ project: ProjectListItem }>("/api/projects", { body: { name: value, status: "IDEA" } });
        setCreated((c) => [{ key: res.project.id, label: `Idee „${res.project.name}“`, href: `/projects/${res.project.id}` }, ...c].slice(0, 5));
      } else {
        if (!projectId) throw new Error("Bitte ein Projekt wählen.");
        const res = await api<{ task: { id: string; title: string } }>(`/api/projects/${projectId}/tasks`, { body: { title: value } });
        const project = projects.find((p) => p.id === projectId);
        setCreated((c) => [{ key: res.task.id, label: `Aufgabe „${res.task.title}“ in ${project?.name ?? "Projekt"}`, href: `/projects/${projectId}` }, ...c].slice(0, 5));
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
    <Modal open={open} onClose={() => setOpen(false)} title={<span className="flex items-center gap-2"><Zap size={18} className="text-accent-ink" /> Schnell erfassen</span>}>
      <form onSubmit={submit} className="space-y-4">
        <Segmented
          label="Was erfassen?"
          value={mode}
          onChange={setMode}
          options={[
            { value: "idea", label: "Idee", icon: <Lightbulb size={14} /> },
            { value: "task", label: "Aufgabe", icon: <ListChecks size={14} /> },
          ]}
        />
        {mode === "task" && (
          <select className="field" value={projectId} onChange={(e) => setProjectId(e.target.value)} aria-label="Projekt">
            {projects.length === 0 && <option value="">Noch keine Projekte</option>}
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}
        <input
          ref={inputRef}
          className="field text-base"
          placeholder={mode === "idea" ? "Was ist die Idee?" : "Was ist zu tun?"}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={mode === "idea" ? 120 : 200}
          autoFocus
          aria-label={mode === "idea" ? "Idee" : "Aufgabe"}
        />
        <FormError message={error} />
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted">Enter legt an – der Dialog bleibt offen.</span>
          <button className="btn btn-primary btn-sm" disabled={busy || !text.trim()}><Zap size={14} /> Anlegen</button>
        </div>
        {created.length > 0 && (
          <ul className="space-y-1 border-t pt-3">
            {created.map((c) => (
              <li key={c.key} className="flex items-center gap-2 text-sm">
                <Check size={14} className="shrink-0 text-emerald-400" />
                <Link href={c.href} className="truncate hover:text-accent-ink" onClick={() => setOpen(false)}>{c.label}</Link>
              </li>
            ))}
          </ul>
        )}
      </form>
    </Modal>
  );
}
