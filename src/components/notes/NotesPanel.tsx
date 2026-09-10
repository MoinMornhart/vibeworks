"use client";

import { useState } from "react";
import { Eye, PencilLine, Pin, PinOff, Plus, Save, StickyNote, Trash2, X } from "lucide-react";
import { Markdown } from "@/components/Markdown";
import { FormError } from "@/components/ui/FormError";
import type { NoteItem } from "@/lib/notes";
import { api, errorMessage } from "@/lib/client/api";
import { cn, formatDateTime, timeAgo } from "@/lib/utils";

function sortNotes(list: NoteItem[]): NoteItem[] {
  return [...list].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt.localeCompare(a.createdAt));
}

function NoteEditor({
  initial,
  busy,
  onSave,
  onCancel,
}: {
  initial?: { title: string | null; content: string };
  busy: boolean;
  onSave: (title: string, content: string) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [tab, setTab] = useState<"write" | "preview">("write");

  const save = () => content.trim() && onSave(title, content);

  return (
    <div className="space-y-3">
      <input className="field" placeholder="Titel (optional)" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} aria-label="Titel der Notiz" />
      <div className="flex gap-1 text-sm" role="tablist">
        {(["write", "preview"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn("inline-flex items-center gap-1.5 rounded-lg px-3 py-1", tab === t ? "bg-accent/15 text-fg" : "text-muted hover:text-fg")}
          >
            {t === "write" ? <><PencilLine size={14} /> Schreiben</> : <><Eye size={14} /> Vorschau</>}
          </button>
        ))}
      </div>
      {tab === "write" ? (
        <textarea
          className="field min-h-40 font-mono text-[0.8125rem] leading-relaxed"
          placeholder={"Gedanken, Links, Checklisten …\n\n- [ ] Erste Aufgabe\n- [ ] Zweite Aufgabe"}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              save();
            }
          }}
          autoFocus
          aria-label="Inhalt der Notiz"
        />
      ) : (
        <div className="min-h-40 rounded-xl border p-4">
          {content.trim() ? <Markdown>{content}</Markdown> : <p className="text-sm text-muted">Nichts zu zeigen.</p>}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-muted">Markdown wird unterstützt · Strg+Enter speichert</span>
        <div className="flex gap-2">
          <button type="button" className="btn btn-sm" onClick={onCancel}><X size={14} /> Abbrechen</button>
          <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={busy || !content.trim()}>
            <Save size={14} /> {busy ? "Speichere …" : "Speichern"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function NotesPanel({ projectId, initial, readOnly = false }: { projectId: string; initial: NoteItem[]; readOnly?: boolean }) {
  const [notes, setNotes] = useState(() => sortNotes(initial));
  const [composing, setComposing] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const replace = (n: NoteItem) => setNotes((list) => sortNotes(list.map((x) => (x.id === n.id ? n : x))));

  async function create(title: string, content: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ note: NoteItem }>(`/api/projects/${projectId}/notes`, { body: { title, content } });
      setNotes((list) => sortNotes([res.note, ...list]));
      setComposing(false);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function update(id: string, data: { title?: string; content?: string; pinned?: boolean }) {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ note: NoteItem }>(`/api/notes/${id}`, { method: "PATCH", body: data });
      replace(res.note);
      setEditing(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove(n: NoteItem) {
    if (!window.confirm("Diese Notiz endgültig löschen?")) return;
    setError(null);
    try {
      await api(`/api/notes/${n.id}`, { method: "DELETE" });
      setNotes((list) => list.filter((x) => x.id !== n.id));
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <section className="glass p-6 sm:p-8" aria-labelledby="notes-heading">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 id="notes-heading" className="flex items-center gap-2 text-lg font-semibold">
          <StickyNote size={18} className="text-accent-ink" /> Notizen
          <span className="rounded-full bg-fg/10 px-2 text-xs font-normal tabular-nums text-muted">{notes.length}</span>
        </h2>
        {!composing && !readOnly && (
          <button className="btn btn-sm" onClick={() => { setComposing(true); setEditing(null); }}>
            <Plus size={15} /> Neue Notiz
          </button>
        )}
      </div>

      {error && <div className="mb-4"><FormError message={error} /></div>}

      {composing && (
        <div className="mb-5 rounded-2xl border border-accent/40 bg-accent/5 p-4">
          <NoteEditor busy={busy} onSave={create} onCancel={() => setComposing(false)} />
        </div>
      )}

      {notes.length === 0 && !composing ? (
        <div className="rounded-2xl border border-dashed px-6 py-10 text-center">
          <p className="font-medium">Noch keine Notizen</p>
          <p className="mt-1 text-sm text-muted">Ideen, Links, Befehle, Checklisten – alles, was sonst in einer Textdatei verschwindet.</p>
          {!readOnly && <button className="btn btn-sm mt-4" onClick={() => setComposing(true)}><Plus size={15} /> Erste Notiz</button>}
        </div>
      ) : (
        <ul className="space-y-4">
          {notes.map((n) => (
            <li
              key={n.id}
              className={cn("group rounded-2xl border p-4 transition", n.pinned ? "border-accent/50 bg-accent/[0.07]" : "bg-bg/20")}
            >
              {editing === n.id ? (
                <NoteEditor
                  initial={n}
                  busy={busy}
                  onSave={(title, content) => void update(n.id, { title, content })}
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <>
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      {n.title && <h3 className="font-semibold">{n.title}</h3>}
                    </div>
                    {!readOnly && (
                    <div className="flex shrink-0 gap-0.5 opacity-60 transition group-hover:opacity-100 focus-within:opacity-100">
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => void update(n.id, { pinned: !n.pinned })} aria-label={n.pinned ? "Lösen" : "Anpinnen"} title={n.pinned ? "Lösen" : "Anpinnen"}>
                        {n.pinned ? <PinOff size={15} /> : <Pin size={15} />}
                      </button>
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => { setEditing(n.id); setComposing(false); }} aria-label="Bearbeiten" title="Bearbeiten">
                        <PencilLine size={15} />
                      </button>
                      <button className="btn btn-ghost btn-icon btn-sm hover:!text-red-400" onClick={() => void remove(n)} aria-label="Löschen" title="Löschen">
                        <Trash2 size={15} />
                      </button>
                    </div>
                    )}
                  </div>
                  <Markdown className={cn(n.title && "mt-2")}>{n.content}</Markdown>
                  <p className="mt-3 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                    {n.pinned && <span className="inline-flex items-center gap-1 text-accent-ink"><Pin size={11} /> angepinnt ·</span>}
                    <span>{formatDateTime(n.createdAt)}</span>
                    {n.edited && <span suppressHydrationWarning>· bearbeitet {timeAgo(n.updatedAt)}</span>}
                  </p>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
