import Link from "next/link";
import { Timer } from "lucide-react";
import { PROJECT_ACCENTS } from "@/lib/status";
import { formatDuration } from "@/lib/time";
import type { TFunction } from "@/lib/i18n/messages";

/** Wochenrückblick: erfasste Zeit je Projekt (Server-Komponente). */
export function WeekTime({ rows, t }: { rows: Array<{ id: string; name: string; accent: string; seconds: number }>; t: TFunction<"time"> }) {
  const total = rows.reduce((s, r) => s + r.seconds, 0);
  const max = Math.max(1, ...rows.map((r) => r.seconds));
  return (
    <section className="glass p-6" aria-labelledby="time-heading">
      <h2 id="time-heading" className="mb-1 flex items-center gap-2 text-lg font-semibold"><Timer size={18} className="text-amber-400" /> {t("weekTitle")}</h2>
      <p className="mb-4 text-sm text-muted">{total ? t("weekTotal", { d: formatDuration(total) }) : t("weekEmpty")}</p>
      {rows.length > 0 && (
        <ul className="space-y-3">
          {rows.map((r) => {
            const accent = PROJECT_ACCENTS[r.accent] ?? PROJECT_ACCENTS.violet;
            return (
              <li key={r.id}>
                <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                  <Link href={`/projects/${r.id}`} className="truncate hover:text-accent-ink">{r.name}</Link>
                  <span className="shrink-0 text-xs tabular-nums text-muted">{formatDuration(r.seconds)}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-fg/10">
                  <div className="h-full rounded-full" style={{ width: `${(r.seconds / max) * 100}%`, background: `linear-gradient(90deg, ${accent.from}, ${accent.to})` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
