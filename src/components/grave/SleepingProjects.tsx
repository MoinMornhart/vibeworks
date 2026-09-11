"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock, Ghost, Moon, Play } from "lucide-react";
import { accentGradient } from "@/components/projects/ProjectCard";
import { api, errorMessage } from "@/lib/client/api";
import { useFormat, useT } from "@/lib/i18n/client";
import { SLEEP_DAYS } from "@/lib/grave";
import { BuryDialog } from "./BuryDialog";

export type SleepingItem = { id: string; name: string; accent: string; since: string };

/** „Schläft seit 30 Tagen“: weitermachen, später fragen oder begraben. */
export function SleepingProjects({ items }: { items: SleepingItem[] }) {
  const t = useT("grave");
  const f = useFormat();
  const router = useRouter();
  const [list, setList] = useState(items);
  useEffect(() => setList(items), [items]);
  const [bury, setBury] = useState<SleepingItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(p: SleepingItem, action: "continue" | "snooze") {
    setError(null);
    try {
      await api(`/api/projects/${p.id}/grave`, { body: { action } });
      setList((l) => l.filter((x) => x.id !== p.id));
      if (action === "continue") router.push(`/projects/${p.id}`);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  if (!list.length) return null;
  return (
    <section className="glass fade-in mb-6 p-5" aria-labelledby="sleeping-heading">
      <h2 id="sleeping-heading" className="flex items-center gap-2 font-semibold">
        <Moon size={16} className="text-accent-ink" /> {t("sleeping.title", { n: list.length })}
      </h2>
      <p className="mt-1 text-sm text-muted">{t("sleeping.text", { days: SLEEP_DAYS })}</p>
      <ul className="mt-3 space-y-2">
        {list.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border px-3 py-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: accentGradient(p.accent) }} />
            <Link href={`/projects/${p.id}`} className="min-w-0 flex-1 truncate font-medium hover:text-accent-ink">{p.name}</Link>
            <span className="text-xs text-muted" suppressHydrationWarning>{t("sleeping.since", { date: f.date(p.since) })}</span>
            <div className="flex flex-wrap gap-1.5">
              <button className="btn btn-sm" onClick={() => void act(p, "continue")}><Play size={13} /> {t("sleeping.continue")}</button>
              <button className="btn btn-sm" onClick={() => void act(p, "snooze")}><Clock size={13} /> {t("sleeping.snooze")}</button>
              <button className="btn btn-sm" onClick={() => setBury(p)}><Ghost size={13} /> {t("sleeping.bury")}</button>
            </div>
          </li>
        ))}
      </ul>
      {error && <p role="alert" className="mt-3 text-sm text-red-400">{error}</p>}
      <BuryDialog
        project={bury}
        onClose={() => setBury(null)}
        onBuried={(id) => {
          setList((l) => l.filter((x) => x.id !== id));
          router.refresh();
        }}
      />
    </section>
  );
}
