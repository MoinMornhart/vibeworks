"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ghost, HeartPulse } from "lucide-react";
import { accentGradient } from "@/components/projects/ProjectCard";
import { api, errorMessage } from "@/lib/client/api";
import { useFormat, useT } from "@/lib/i18n/client";
import { isCause, lifespanDays } from "@/lib/grave";

export interface Grave {
  id: string;
  name: string;
  accent: string;
  bornAt: string;
  buriedAt: string;
  cause: string | null;
  epitaph: string | null;
  tasks: number;
  tasksDone: number;
  notes: number;
  commits: number;
}

export function Graveyard({ graves }: { graves: Grave[] }) {
  const t = useT("grave");
  const f = useFormat();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function resurrect(g: Grave) {
    setBusy(g.id);
    setError(null);
    try {
      await api(`/api/projects/${g.id}/grave`, { body: { action: "resurrect" } });
      router.push(`/projects/${g.id}`);
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(null);
    }
  }

  return (
    <div className="fade-in">
      <header className="mb-8">
        <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight"><Ghost size={28} className="text-accent-ink" /> {t("page.title")}</h1>
        <p className="mt-1 text-muted">{graves.length ? t("page.summary", { n: graves.length }) : t("page.emptyTitle")}</p>
      </header>
      {error && <p role="alert" className="mb-4 text-sm text-red-400">{error}</p>}

      {graves.length === 0 ? (
        <div className="glass px-6 py-14 text-center">
          <p className="text-4xl" aria-hidden>🌱</p>
          <p className="mt-2 font-medium">{t("page.emptyTitle")}</p>
          <p className="mt-1 text-sm text-muted">{t("page.emptyHint")}</p>
        </div>
      ) : (
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {graves.map((g) => (
            <li key={g.id} data-testid="grave" className="glass relative flex flex-col items-center overflow-hidden rounded-b-2xl rounded-t-[7rem] px-6 pb-6 pt-10 text-center">
              <div className="absolute inset-x-0 top-0 h-1 opacity-60" style={{ background: accentGradient(g.accent) }} />
              <p className="text-3xl" aria-hidden>🪦</p>
              <p className="mt-1 text-[11px] uppercase tracking-[0.3em] text-muted">{t("stone.rip")}</p>
              <h2 className="mt-2 break-words text-xl font-bold">{g.name}</h2>
              <p className="mt-1 text-sm tabular-nums text-muted">{f.date(g.bornAt)} – {f.date(g.buriedAt)}</p>
              <p className="text-xs text-muted">{t("stone.lifespan", { n: lifespanDays(g.bornAt, g.buriedAt) })}</p>
              {g.epitaph && <blockquote className="mt-4 text-sm italic">{t("stone.epitaph", { text: g.epitaph })}</blockquote>}
              {isCause(g.cause) && <p className="chip mt-3">{t("stone.cause", { cause: t(`causes.${g.cause}`) })}</p>}
              <dl className="mt-4 grid w-full grid-cols-3 gap-2 text-xs text-muted">
                <div>
                  <dt>{t("stone.tasks")}</dt>
                  <dd className="text-base font-semibold tabular-nums text-fg">{g.tasksDone}/{g.tasks}</dd>
                </div>
                <div>
                  <dt>{t("stone.commits")}</dt>
                  <dd className="text-base font-semibold tabular-nums text-fg">{g.commits >= 100 ? "100+" : g.commits}</dd>
                </div>
                <div>
                  <dt>{t("stone.notes")}</dt>
                  <dd className="text-base font-semibold tabular-nums text-fg">{g.notes}</dd>
                </div>
              </dl>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <Link href={`/projects/${g.id}`} className="btn btn-sm">{t("stone.visit")}</Link>
                <button className="btn btn-primary btn-sm" disabled={busy === g.id} onClick={() => void resurrect(g)}>
                  <HeartPulse size={14} /> {t("stone.resurrect")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
