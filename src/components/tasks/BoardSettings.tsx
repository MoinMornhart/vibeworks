"use client";

import { useState } from "react";
import type { TaskStatus } from "@/generated/prisma/client";
import { ArrowDown, ArrowUp, Plus, RotateCcw, Save, Trash2, X } from "lucide-react";
import { BOARD_STATUSES, baseOf, COLLAPSE_OPTIONS, DEFAULT_BOARD, isExtraKey, MAX_COLUMN_LABEL, nextExtraKey, type BoardConfig, type ColumnKey } from "@/lib/boardConfig";
import { api, errorMessage } from "@/lib/client/api";
import { FormError } from "@/components/ui/FormError";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

/** Aufgabenbrett einstellen: Spalten umbenennen, verschieben, ausblenden, für KI sperren, Zusatz-Spalten anlegen; Einklappen ab N Karten. */
export function BoardSettings({
  projectId,
  value,
  defaultLimit,
  labelOf,
  colorOf,
  onSaved,
  onClose,
}: {
  projectId: string;
  value: BoardConfig;
  defaultLimit: number;
  /** Standardname eines Status */
  labelOf: (s: TaskStatus) => string;
  colorOf: (s: TaskStatus) => string;
  onSaved: (b: BoardConfig) => void;
  onClose: () => void;
}) {
  const t = useT("tasks");
  const [cfg, setCfg] = useState<BoardConfig>(value);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newBase, setNewBase] = useState<TaskStatus>("DOING");

  const extraOf = (k: ColumnKey) => cfg.extra.find((x) => x.key === k);
  const nameOf = (k: ColumnKey) => extraOf(k)?.label ?? cfg.labels[k as TaskStatus] ?? labelOf(k as TaskStatus);

  const move = (i: number, dir: -1 | 1) =>
    setCfg((c) => {
      const order = [...c.order];
      const j = i + dir;
      if (j < 0 || j >= order.length) return c;
      [order[i], order[j]] = [order[j], order[i]];
      return { ...c, order };
    });
  const toggleIn = (list: "hidden" | "aiLocked", k: ColumnKey) =>
    setCfg((c) => {
      const next = c[list].includes(k) ? c[list].filter((x) => x !== k) : [...c[list], k];
      return list === "hidden" && next.length >= c.order.length ? c : { ...c, [list]: next };
    });
  const setLabel = (k: ColumnKey, v: string) =>
    setCfg((c) =>
      isExtraKey(k) ? { ...c, extra: c.extra.map((x) => (x.key === k ? { ...x, label: v } : x)) } : { ...c, labels: { ...c.labels, [k]: v } },
    );
  const addColumn = () => {
    const key = nextExtraKey(cfg);
    const label = newName.trim();
    if (!key || !label) return;
    setCfg((c) => {
      // Neue Spalte hinter die Grundspalte und deren bisherige Zusatz-Spalten
      const at = c.order.reduce((last, k, i) => (baseOf(c, k) === newBase ? i : last), -1);
      const order = [...c.order];
      order.splice(at < 0 ? order.length : at + 1, 0, key);
      return { ...c, order, extra: [...c.extra, { key, label: label.slice(0, MAX_COLUMN_LABEL), base: newBase }] };
    });
    setNewName("");
  };
  const removeColumn = (k: ColumnKey) =>
    setCfg((c) => ({
      ...c,
      extra: c.extra.filter((x) => x.key !== k),
      order: c.order.filter((x) => x !== k),
      hidden: c.hidden.filter((x) => x !== k),
      aiLocked: c.aiLocked.filter((x) => x !== k),
    }));

  async function save() {
    setBusy(true);
    setError(null);
    try {
      // Leere Namen von Zusatz-Spalten nicht wegwerfen lassen
      const board = { ...cfg, extra: cfg.extra.map((x) => ({ ...x, label: x.label.trim() || labelOf(x.base) })) };
      const res = await api<{ board: BoardConfig }>(`/api/projects/${projectId}/board`, { method: "PATCH", body: { board } });
      onSaved(res.board);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fade-in mb-5 space-y-4 rounded-2xl border border-accent/40 bg-accent/5 p-4" data-testid="board-settings">
      <div>
        <h3 className="text-sm font-semibold">{t("board.settings.title")}</h3>
        <p className="text-xs text-muted">{t("board.settings.hint")}</p>
      </div>
      <ol className="space-y-2">
        {cfg.order.map((k, i) => {
          const hidden = cfg.hidden.includes(k);
          const extra = extraOf(k);
          const base = baseOf(cfg, k);
          return (
            <li key={k} className={cn("flex flex-wrap items-center gap-2 rounded-xl border bg-bg/30 px-3 py-2", hidden && "opacity-60", extra && "border-dashed")} data-testid="board-column-setting">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colorOf(base) }} aria-hidden />
              <input
                className="field !w-auto min-w-0 flex-1 !py-1 text-sm"
                value={extra ? extra.label : (cfg.labels[k as TaskStatus] ?? "")}
                placeholder={extra ? "" : labelOf(k as TaskStatus)}
                maxLength={MAX_COLUMN_LABEL}
                aria-label={t("board.settings.name", { status: nameOf(k) })}
                onChange={(e) => setLabel(k, e.target.value)}
              />
              {extra && <span className="text-[11px] text-muted">{t("board.settings.extraOf", { base: cfg.labels[base] || labelOf(base) })}</span>}
              <label className="flex cursor-pointer items-center gap-1.5 text-xs">
                <input type="checkbox" className="h-4 w-4 accent-[var(--vw-accent)]" checked={!hidden} onChange={() => toggleIn("hidden", k)} />
                {t("board.settings.visible")}
              </label>
              <label className="flex cursor-pointer items-center gap-1.5 text-xs" title={t("aiLock.columnHint")}>
                <input type="checkbox" className="h-4 w-4 accent-[var(--vw-accent)]" checked={cfg.aiLocked.includes(k)} onChange={() => toggleIn("aiLocked", k)} data-testid="board-column-ai-lock" />
                🔒 {t("aiLock.column")}
              </label>
              <span className="flex">
                <button type="button" className="btn btn-ghost btn-icon btn-sm" disabled={i === 0} onClick={() => move(i, -1)} aria-label={t("board.settings.up", { status: nameOf(k) })}>
                  <ArrowUp size={14} />
                </button>
                <button type="button" className="btn btn-ghost btn-icon btn-sm" disabled={i === cfg.order.length - 1} onClick={() => move(i, 1)} aria-label={t("board.settings.down", { status: nameOf(k) })}>
                  <ArrowDown size={14} />
                </button>
                {extra && (
                  <button type="button" className="btn btn-ghost btn-icon btn-sm hover:!text-red-400" onClick={() => removeColumn(k)} aria-label={t("board.settings.removeColumn", { name: nameOf(k) })} data-testid="board-column-remove">
                    <Trash2 size={14} />
                  </button>
                )}
              </span>
            </li>
          );
        })}
      </ol>
      {nextExtraKey(cfg) && (
        <div className="rounded-xl border border-dashed px-3 py-2" data-testid="board-add-column">
          <p className="mb-1.5 text-xs font-medium">{t("board.settings.addTitle")}</p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="field !w-auto min-w-0 flex-1 !py-1 text-sm"
              value={newName}
              maxLength={MAX_COLUMN_LABEL}
              placeholder={t("board.settings.addPlaceholder")}
              aria-label={t("board.settings.addTitle")}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addColumn();
                }
              }}
            />
            <label className="flex items-center gap-1.5 text-xs">
              {t("board.settings.addBase")}
              <select className="field !w-auto !py-1 text-sm" value={newBase} onChange={(e) => setNewBase(e.target.value as TaskStatus)}>
                {BOARD_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {cfg.labels[s] || labelOf(s)}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="btn btn-sm" disabled={!newName.trim()} onClick={addColumn} data-testid="board-add-column-button">
              <Plus size={14} /> {t("board.settings.add")}
            </button>
          </div>
          <p className="mt-1 text-[11px] text-muted">{t("board.settings.addHint")}</p>
        </div>
      )}
      <div>
        <label className="label" htmlFor="board-collapse">{t("board.settings.collapse")}</label>
        <select id="board-collapse" className="field !w-auto" value={cfg.collapseAfter} onChange={(e) => setCfg((c) => ({ ...c, collapseAfter: Number(e.target.value) }))}>
          {COLLAPSE_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n === 0 ? t("board.settings.collapseDefault", { n: defaultLimit || "∞" }) : t("board.settings.collapseAfter", { n })}
            </option>
          ))}
        </select>
      </div>
      <FormError message={error} />
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void save()} data-testid="board-settings-save">
          <Save size={14} /> {t("board.settings.save")}
        </button>
        <button type="button" className="btn btn-sm" disabled={busy} onClick={() => setCfg(DEFAULT_BOARD)}>
          <RotateCcw size={14} /> {t("board.settings.reset")}
        </button>
        <button type="button" className="btn btn-sm" onClick={onClose}>
          <X size={14} /> {t("board.settings.cancel")}
        </button>
      </div>
    </div>
  );
}
