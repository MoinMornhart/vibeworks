"use client";

import { useState } from "react";
import type { ProjectStatus } from "@prisma/client";
import { CheckCheck, Minus, Plus, Star, StarOff, Tags, Trash2, X } from "lucide-react";
import { PROJECT_STATUSES } from "@/lib/status";
import { useT } from "@/lib/i18n/client";

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
  const t = useT("projects");
  const ts = useT("status");
  const tc = useT("common");
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
    <div className="fixed inset-x-0 bottom-3 z-50 flex justify-center px-3" role="region" aria-label={t("bulk.region")}>
      <div className="glass-strong fade-in flex max-w-full flex-wrap items-center gap-2 px-3 py-2">
        <span className="px-1 text-sm font-medium tabular-nums">{t("bulk.selected", { n: count })}</span>
        {count < total && (
          <button className="btn btn-ghost btn-sm" onClick={onSelectAll} title={t("bulk.selectAllTitle")}>
            <CheckCheck size={15} /> <span className="hidden sm:inline">{t("bulk.selectAll", { n: total })}</span>
          </button>
        )}
        <span className="mx-1 hidden h-6 w-px bg-fg/15 sm:block" />
        <select
          className="field !min-h-8 !w-auto !py-1 text-sm"
          value=""
          disabled={busy}
          onChange={(e) => e.target.value && void run({ action: "status", status: e.target.value as ProjectStatus })}
          aria-label={t("bulk.setStatus")}
        >
          <option value="">{t("bulk.setStatusPlaceholder")}</option>
          {PROJECT_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>{ts(`project.${s.value}`)}</option>
          ))}
        </select>
        {tagsOpen ? (
          <span className="flex items-center gap-1">
            <input className="field !min-h-8 !w-40 !py-1 text-sm" placeholder={t("bulk.tagsPlaceholder")} value={tags} onChange={(e) => setTags(e.target.value)} autoFocus aria-label={t("bulk.tags")} />
            <button className="btn btn-sm" disabled={busy || !tags.trim()} onClick={() => void run({ action: "addTags", tags })} title={t("bulk.addTags")}><Plus size={14} /></button>
            <button className="btn btn-sm" disabled={busy || !tags.trim()} onClick={() => void run({ action: "removeTags", tags })} title={t("bulk.removeTags")}><Minus size={14} /></button>
          </span>
        ) : (
          <button className="btn btn-sm" onClick={() => setTagsOpen(true)}><Tags size={14} /> {t("bulk.tags")}</button>
        )}
        <button className="btn btn-sm" disabled={busy} onClick={() => void run({ action: "favorite", favorite: true })} title={t("card.favoriteAdd")}><Star size={14} /></button>
        <button className="btn btn-sm" disabled={busy} onClick={() => void run({ action: "favorite", favorite: false })} title={t("card.favoriteRemove")}><StarOff size={14} /></button>
        <button
          className="btn btn-danger btn-sm"
          disabled={busy}
          onClick={() => {
            if (window.confirm(t("bulk.confirmDelete", { n: count }))) void run({ action: "delete" });
          }}
        >
          <Trash2 size={14} /> <span className="hidden sm:inline">{tc("delete")}</span>
        </button>
        <button className="btn btn-ghost btn-icon btn-sm" onClick={onClear} aria-label={t("bulk.clear")}><X size={16} /></button>
      </div>
    </div>
  );
}
