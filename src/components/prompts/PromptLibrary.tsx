"use client";

import { useMemo, useState } from "react";
import { Check, Copy, MessageSquare, Pencil, Plus, Search, Sparkles, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { FormError } from "@/components/ui/FormError";
import { api, ApiClientError, errorMessage } from "@/lib/client/api";
import { useT } from "@/lib/i18n/client";
import { fillPrompt, PLACEHOLDERS, type PromptItem } from "@/lib/prompts";

export type PromptProject = { id: string; name: string; repoUrl: string | null; liveUrl: string | null; summary: string | null };

type Form = { title: string; body: string; tags: string; projectId: string };
const EMPTY: Form = { title: "", body: "", tags: "", projectId: "" };

export function PromptLibrary({ initial, projects }: { initial: PromptItem[]; projects: PromptProject[] }) {
  const t = useT("prompts");
  const [prompts, setPrompts] = useState(initial);
  const [query, setQuery] = useState("");
  const [projectId, setProjectId] = useState("");
  const [editing, setEditing] = useState<PromptItem | "new" | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const project = projects.find((p) => p.id === projectId) ?? null;
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return prompts.filter(
      (p) =>
        (!projectId || !p.projectId || p.projectId === projectId) &&
        (!q || [p.title, p.body, ...p.tags].some((s) => s.toLowerCase().includes(q))),
    );
  }, [prompts, query, projectId]);

  function open(p: PromptItem | "new") {
    setEditing(p);
    setError(null);
    setFieldErrors({});
    setForm(p === "new" ? { ...EMPTY, projectId } : { title: p.title, body: p.body, tags: p.tags.join(", "), projectId: p.projectId ?? "" });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      const body = { ...form, projectId: form.projectId || null };
      const res =
        editing === "new"
          ? await api<{ prompt: PromptItem }>("/api/prompts", { body })
          : await api<{ prompt: PromptItem }>(`/api/prompts/${editing.id}`, { method: "PATCH", body });
      setPrompts((list) => (editing === "new" ? [res.prompt, ...list] : list.map((x) => (x.id === res.prompt.id ? res.prompt : x))));
      setEditing(null);
    } catch (err) {
      if (err instanceof ApiClientError) setFieldErrors(err.fieldErrors);
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(p: PromptItem) {
    if (!window.confirm(t("page.confirmDelete", { title: p.title }))) return;
    try {
      await api(`/api/prompts/${p.id}`, { method: "DELETE" });
      setPrompts((list) => list.filter((x) => x.id !== p.id));
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function copy(p: PromptItem) {
    const text = fillPrompt(p.body, project);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* Zwischenablage gesperrt – der Text steht ja da */
    }
    setCopied(p.id);
    setTimeout(() => setCopied((c) => (c === p.id ? null : c)), 2000);
    setPrompts((list) => list.map((x) => (x.id === p.id ? { ...x, uses: x.uses + 1 } : x)));
    void api(`/api/prompts/${p.id}/use`, { body: {} }).catch(() => {});
  }

  async function addStarters() {
    setError(null);
    try {
      const res = await api<{ added: number; prompts: PromptItem[] }>("/api/prompts/starter", { body: {} });
      setPrompts(res.prompts);
      setNotice(t("page.starterDone", { n: res.added }));
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <div className="fade-in">
      <header className="mb-6 flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight"><MessageSquare size={26} className="text-accent-ink" /> {t("page.title")}</h1>
          <p className="mt-1 text-muted">{t("page.subtitle")}</p>
        </div>
        <button className="btn btn-sm" onClick={() => void addStarters()}><Sparkles size={14} /> {t("page.starter")}</button>
        <button className="btn btn-primary btn-sm" onClick={() => open("new")}><Plus size={14} /> {t("page.new")}</button>
      </header>

      <div className="glass mb-6 flex flex-wrap items-center gap-2 p-2">
        <div className="relative min-w-0 flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input className="field !pl-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("page.search")} aria-label={t("page.search")} />
        </div>
        <select className="field !w-auto" value={projectId} onChange={(e) => setProjectId(e.target.value)} aria-label={t("page.project")}>
          <option value="">{t("page.allProjects")}</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>
      {project && <p className="-mt-3 mb-4 text-xs text-muted">{t("page.fillHint", { name: project.name })}</p>}
      {notice && <p role="status" className="mb-4 text-sm text-emerald-400">{notice}</p>}
      {error && !editing && <p role="alert" className="mb-4 text-sm text-red-400">{error}</p>}

      {prompts.length === 0 ? (
        <div className="glass px-6 py-14 text-center">
          <p className="font-medium">{t("page.empty")}</p>
          <p className="mt-1 text-sm text-muted">{t("page.emptyHint")}</p>
        </div>
      ) : visible.length === 0 ? (
        <p className="text-sm text-muted">{t("page.noHits")}</p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {visible.map((p) => (
            <li key={p.id} data-testid="prompt" className="glass flex flex-col p-5">
              <div className="flex items-start gap-2">
                <h2 className="min-w-0 flex-1 break-words font-semibold">{p.title}</h2>
                <button className="btn btn-ghost btn-icon btn-sm" onClick={() => open(p)} aria-label={t("page.edit")} title={t("page.edit")}><Pencil size={14} /></button>
                <button className="btn btn-ghost btn-icon btn-sm" onClick={() => void remove(p)} aria-label={t("page.delete")} title={t("page.delete")}><Trash2 size={14} /></button>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                <span className="chip !py-0">{p.project ? p.project.name : t("page.general")}</span>
                {p.tags.map((tag) => (
                  <span key={tag} className="chip !py-0">#{tag}</span>
                ))}
                <span className="ml-auto tabular-nums">{t("page.uses", { n: p.uses })}</span>
              </div>
              <pre className="mt-3 line-clamp-6 flex-1 whitespace-pre-wrap break-words rounded-lg bg-fg/5 p-3 font-sans text-sm text-muted" data-testid="prompt-body">
                {fillPrompt(p.body, project)}
              </pre>
              <button className="btn btn-sm mt-3 self-start" onClick={() => void copy(p)}>
                {copied === p.id ? <Check size={14} /> : <Copy size={14} />} {copied === p.id ? t("page.copied") : t("page.copy")}
              </button>
            </li>
          ))}
        </ul>
      )}

      <Modal open={editing !== null} onClose={() => setEditing(null)} size="lg" title={editing === "new" ? t("dialog.newTitle") : t("dialog.editTitle")}>
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className="label" htmlFor="prompt-title">{t("dialog.title")}</label>
            <input id="prompt-title" className="field" value={form.title} onChange={(e) => set("title", e.target.value)} maxLength={120} autoFocus />
            {fieldErrors.title && <p className="mt-1 text-xs text-red-400">{fieldErrors.title}</p>}
          </div>
          <div>
            <label className="label" htmlFor="prompt-body">{t("dialog.body")}</label>
            <textarea id="prompt-body" className="field min-h-60 font-mono text-sm" value={form.body} onChange={(e) => set("body", e.target.value)} maxLength={20_000} />
            {fieldErrors.body && <p className="mt-1 text-xs text-red-400">{fieldErrors.body}</p>}
            <p className="mt-1 text-xs text-muted">
              {t("dialog.vars")}{" "}
              {PLACEHOLDERS.map((ph) => (
                <code key={ph} className="mr-1 rounded bg-fg/10 px-1">{ph}</code>
              ))}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="prompt-tags">{t("dialog.tags")}</label>
              <input id="prompt-tags" className="field" value={form.tags} onChange={(e) => set("tags", e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="prompt-project">{t("dialog.project")}</label>
              <select id="prompt-project" className="field" value={form.projectId} onChange={(e) => set("projectId", e.target.value)}>
                <option value="">{t("dialog.none")}</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>
          <FormError message={error} />
          <div className="flex justify-end gap-2">
            <button type="button" className="btn" onClick={() => setEditing(null)}>{t("dialog.cancel")}</button>
            <button className="btn btn-primary" disabled={busy}>{t("dialog.save")}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
