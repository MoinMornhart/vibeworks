"use client";

import { useState } from "react";
import type { TaskStatus } from "@/generated/prisma/client";
import { ArrowDown, ArrowUp, RotateCcw, Save, X } from "lucide-react";
import { COLLAPSE_OPTIONS, DEFAULT_BOARD, MAX_COLUMN_LABEL, type BoardConfig } from "@/lib/boardConfig";
import { api, errorMessage } from "@/lib/client/api";
import { FormError } from "@/components/ui/FormError";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

/** Aufgabenbrett einstellen: Spalten umbenennen, verschieben, ausblenden; Einklappen ab N Karten. */
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
  labelOf: (s: TaskStatus) => string;
  colorOf: (s: TaskStatus) => string;
  onSaved: (b: BoardConfig) => void;
  onClose: () => void;
}) {
  const t = useT("tasks");
  const [cfg, setCfg] = useState<BoardConfig>(value);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const move = (i: number, dir: -1 | 1) =>
    setCfg((c) => {
      const order = [...c.order];
      const j = i + dir;
      if (j < 0 || j >= order.length) return c;
      [order[i], order[j]] = [order[j], order[i]];
      return { ...c, order };
    });
  const toggleHidden = (s: TaskStatus) =>
    setCfg((c) => {
      const hidden = c.hidden.includes(s) ? c.hidden.filter((x) => x !== s) : [...c.hidden, s];
      return hidden.length >= c.order.length ? c : { ...c, hidden };
    });
  const toggleAiLock = (s: TaskStatus) =>
    setCfg((c) => ({ ...c, aiLocked: c.aiLocked.includes(s) ? c.aiLocked.filter((x) => x !== s) : [...c.aiLocked, s] }));
  const setLabel = (s: TaskStatus, v: string) => setCfg((c) => ({ ...c, labels: { ...c.labels, [s]: v } }));

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ board: BoardConfig }>(`/api/projects/${projectId}/board`, { method: "PATCH", body: { board: cfg } });
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
        {cfg.order.map((s, i) => {
          const hidden = cfg.hidden.includes(s);
          return (
            <li key={s} className={cn("flex flex-wrap items-center gap-2 rounded-xl border bg-bg/30 px-3 py-2", hidden && "opacity-60")} data-testid="board-column-setting">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colorOf(s) }} aria-hidden />
              <input
                className="field !w-auto min-w-0 flex-1 !py-1 text-sm"
                value={cfg.labels[s] ?? ""}
                placeholder={labelOf(s)}
                maxLength={MAX_COLUMN_LABEL}
                aria-label={t("board.settings.name", { status: labelOf(s) })}
                onChange={(e) => setLabel(s, e.target.value)}
              />
              <label className="flex cursor-pointer items-center gap-1.5 text-xs">
                <input type="checkbox" className="h-4 w-4 accent-[var(--vw-accent)]" checked={!hidden} onChange={() => toggleHidden(s)} />
                {t("board.settings.visible")}
              </label>
              <label className="flex cursor-pointer items-center gap-1.5 text-xs" title={t("aiLock.columnHint")}>
                <input type="checkbox" className="h-4 w-4 accent-[var(--vw-accent)]" checked={cfg.aiLocked.includes(s)} onChange={() => toggleAiLock(s)} data-testid="board-column-ai-lock" />
                🔒 {t("aiLock.column")}
              </label>
              <span className="flex">
                <button type="button" className="btn btn-ghost btn-icon btn-sm" disabled={i === 0} onClick={() => move(i, -1)} aria-label={t("board.settings.up", { status: labelOf(s) })}>
                  <ArrowUp size={14} />
                </button>
                <button type="button" className="btn btn-ghost btn-icon btn-sm" disabled={i === cfg.order.length - 1} onClick={() => move(i, 1)} aria-label={t("board.settings.down", { status: labelOf(s) })}>
                  <ArrowDown size={14} />
                </button>
              </span>
            </li>
          );
        })}
      </ol>
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
        <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void save()}>
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
