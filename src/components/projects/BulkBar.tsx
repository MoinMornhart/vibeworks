"use client";

import { useState } from "react";
import type { ProjectStatus } from "@prisma/client";
import { CheckCheck, Minus, Plus, Star, StarOff, Tags, Trash2, X } from "lucide-react";
import { PROJECT_STATUSES } from "@/lib/status";

export type BulkAction =
  | { action: "status"; status: ProjectStatus }
  | { action: "addTags"; tags: string }
  | { action: "removeTags"; tags: string }
  | { action: "favorite"; favorite: boolean }
  | { action: "delete" };

// Leiste für Mehrfachaktionen – fährt unten ein, sobald etwas ausgewählt ist.
export function BulkBar({
  count,
  total,
  onAction,
  onSelectAll,
  onClear,
}: {
  count: number;
  total: number;
  onAction: (a: BulkAction) => Promise<void>;
  onSelectAll: () => void;
  onClear: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [tags, setTags] = useState("");

  if (count === 0) return null;

  async function run(a: BulkAction) {
    setBusy(true);
    try {
      await onAction(a);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-x-0 bottom-3 z-50 flex justify-center px-3" role="region" aria-label="Mehrfachauswahl">
      <div className="glass-strong fade-in flex max-w-full flex-wrap items-center gap-2 px-3 py-2">
        <span className="px-1 text-sm font-medium tabular-nums">{count} ausgewählt</span>
        {count < total && (
          <button className="btn btn-ghost btn-sm" onClick={onSelectAll} title="Alle sichtbaren auswählen">
            <CheckCheck size={15} /> <span className="hidden sm:inline">Alle ({total})</span>
          </button>
        )}
        <span className="mx-1 hidden h-6 w-px bg-fg/15 sm:block" />
        <select
          className="field !min-h-8 !w-auto !py-1 text-sm"
          value=""
          disabled={busy}
          onChange={(e) => e.target.value && void run({ action: "status", status: e.target.value as ProjectStatus })}
          aria-label="Status setzen"
        >
          <option value="">Status setzen …</option>
          {PROJECT_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        {tagsOpen ? (
          <span className="flex items-center gap-1">
            <input className="field !min-h-8 !w-40 !py-1 text-sm" placeholder="tag, noch-einer" value={tags} onChange={(e) => setTags(e.target.value)} autoFocus aria-label="Tags" />
            <button className="btn btn-sm" disabled={busy || !tags.trim()} onClick={() => void run({ action: "addTags", tags })} title="Tags ergänzen"><Plus size={14} /></button>
            <button className="btn btn-sm" disabled={busy || !tags.trim()} onClick={() => void run({ action: "removeTags", tags })} title="Tags entfernen"><Minus size={14} /></button>
          </span>
        ) : (
          <button className="btn btn-sm" onClick={() => setTagsOpen(true)}><Tags size={14} /> Tags</button>
        )}
        <button className="btn btn-sm" disabled={busy} onClick={() => void run({ action: "favorite", favorite: true })} title="Als Favorit markieren"><Star size={14} /></button>
        <button className="btn btn-sm" disabled={busy} onClick={() => void run({ action: "favorite", favorite: false })} title="Favorit entfernen"><StarOff size={14} /></button>
        <button
          className="btn btn-danger btn-sm"
          disabled={busy}
          onClick={() => {
            if (window.confirm(`${count} Projekt${count === 1 ? "" : "e"} mit allen Notizen und Aufgaben endgültig löschen?`)) void run({ action: "delete" });
          }}
        >
          <Trash2 size={14} /> <span className="hidden sm:inline">Löschen</span>
        </button>
        <button className="btn btn-ghost btn-icon btn-sm" onClick={onClear} aria-label="Auswahl aufheben"><X size={16} /></button>
      </div>
    </div>
  );
}
