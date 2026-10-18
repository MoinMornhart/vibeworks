"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, Pin, Plus, Search, Shapes } from "lucide-react";
import type { BoardOverviewItem, DocDetail } from "@/lib/docs";
import type { BoardColor, BoardPreview } from "@/lib/docs/boardLogic";
import { docIcon } from "@/lib/docs/kinds";
import { api, errorMessage } from "@/lib/client/api";
import { useFormat, useT } from "@/lib/i18n/client";

// Übersicht aller Leinwände (#211): jede mit kleinem Abbild, Suche und
// „Neue Leinwand“. Geöffnet wird wie bisher über /docs/<id>.

const FILL: Record<BoardColor, string> = {
  yellow: "fill-amber-300 stroke-amber-400",
  green: "fill-emerald-300 stroke-emerald-400",
  blue: "fill-sky-300 stroke-sky-400",
  violet: "fill-violet-300 stroke-violet-400",
  red: "fill-rose-300 stroke-rose-400",
  gray: "fill-slate-300 stroke-slate-400",
};

/** Maße der Vorschau – im Rahmen mit Breite 100. */
const OUTLINE = 0.6;
const NOTE_RADIUS = 1.2;
const SHAPE_RADIUS = 0.6;
const SOFT_OPACITY = 0.25;
const half = (n: number) => n / 2;

function Preview({ preview }: { preview: BoardPreview }) {
  if (!preview.shapes.length) {
    return <div className="flex aspect-[5/3] items-center justify-center text-muted"><Shapes size={28} aria-hidden /></div>;
  }
  return (
    <svg viewBox={`0 0 100 ${preview.height}`} className="aspect-[5/3] w-full" preserveAspectRatio="xMidYMid meet" aria-hidden>
      {preview.shapes.map((s, n) => {
        const cx = s.x + half(s.w);
        const cy = s.y + half(s.h);
        const turn = s.rotation ? `rotate(${s.rotation} ${cx} ${cy})` : undefined;
        const cls = FILL[s.color];
        if (s.kind === "ellipse") {
          return <ellipse key={n} cx={cx} cy={cy} rx={half(s.w)} ry={half(s.h)} className={cls} fillOpacity={SOFT_OPACITY} strokeWidth={OUTLINE} transform={turn} />;
        }
        const soft = s.kind === "rect" || s.kind === "text" || s.kind === "ink";
        return (
          <rect
            key={n}
            x={s.x}
            y={s.y}
            width={s.w}
            height={s.h}
            rx={s.kind === "note" ? NOTE_RADIUS : SHAPE_RADIUS}
            className={s.kind === "image" ? "fill-fg/15" : cls}
            fillOpacity={soft ? SOFT_OPACITY : 1}
            strokeWidth={s.kind === "rect" ? OUTLINE : 0}
            strokeDasharray={s.kind === "ink" ? "1 1" : undefined}
            transform={turn}
          />
        );
      })}
    </svg>
  );
}

export function BoardsOverview({ boards }: { boards: BoardOverviewItem[] }) {
  const t = useT("docs");
  const f = useFormat();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shown = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    return q ? boards.filter((b) => b.title.toLocaleLowerCase().includes(q)) : boards;
  }, [boards, query]);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ doc: DocDetail }>("/api/docs", { body: { parentId: null, kind: "BOARD", title: t("tree.defaultBoardTitle") } });
      router.push(`/docs/${res.doc.id}`);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <div className="glass p-6 sm:p-8" data-boards-overview>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><Shapes size={22} aria-hidden /> {t("boards.title")}</h1>
          <p className="mt-1 text-sm text-muted">{t("boards.subtitle")}</p>
        </div>
        <span className="flex flex-wrap gap-2">
          <Link href="/docs" className="btn btn-sm"><BookOpen size={15} /> {t("boards.toDocs")}</Link>
          <button className="btn btn-primary btn-sm" onClick={() => void create()} disabled={busy} data-boards-new>
            <Plus size={15} /> {t("tree.newBoard")}
          </button>
        </span>
      </div>
      {error && <p role="alert" className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}

      {boards.length === 0 ? (
        <div className="mt-10 flex flex-col items-center gap-3 py-8 text-center">
          <Shapes size={40} className="text-muted" aria-hidden />
          <p className="font-medium">{t("boards.emptyTitle")}</p>
          <p className="max-w-md text-sm text-muted">{t("boards.emptyText")}</p>
          <button className="btn btn-primary mt-2" onClick={() => void create()} disabled={busy}><Plus size={17} /> {t("home.createBoard")}</button>
        </div>
      ) : (
        <>
          <label className="relative mt-6 block max-w-sm">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
            <input className="field pl-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("boards.search")} aria-label={t("boards.search")} />
          </label>
          {shown.length === 0 ? (
            <p className="mt-6 text-sm text-muted">{t("boards.noMatch")}</p>
          ) : (
            <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {shown.map((b) => (
                <li key={b.id}>
                  <Link href={`/docs/${b.id}`} className="lift block overflow-hidden rounded-xl border bg-bg/20" data-board-card={b.id}>
                    <div className="border-b bg-bg/30 p-2">
                      <Preview preview={b.preview} />
                    </div>
                    <div className="flex items-center gap-3 p-3">
                      <span className="text-2xl" aria-hidden>{docIcon(b)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5 truncate font-medium">
                          {b.pinned && <Pin size={13} className="shrink-0 text-accent-ink" aria-label={t("boards.pinned")} />}
                          <span className="truncate">{b.title}</span>
                        </span>
                        <span className="block text-xs text-muted" suppressHydrationWarning>
                          {t("editor.board.items", { n: b.preview.count })} · {f.ago(b.updatedAt)}
                        </span>
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
