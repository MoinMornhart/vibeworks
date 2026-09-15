"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Lightbulb, X } from "lucide-react";
import type { SuggestionItem } from "@/lib/suggestions";
import { api, errorMessage } from "@/lib/client/api";
import { FormError } from "@/components/ui/FormError";
import { useLocale, useMsg, useT } from "@/lib/i18n/client";
import { suggestionVars } from "@/lib/suggestionsLogic";

// Wochen-Vorschläge auf dem Dashboard: offene zum Annehmen oder Ablehnen,
// eben angenommene mit Link – abgelehnte verschwinden.
export function WeeklySuggestions({ initial }: { initial: SuggestionItem[] }) {
  const t = useT("suggestions");
  const msg = useMsg();
  const locale = useLocale();
  const [items, setItems] = useState(initial);
  const [justAccepted, setJustAccepted] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visible = items.filter((s) => s.status === "OPEN" || justAccepted.has(s.id));
  if (!visible.length) return null;

  const vars = (s: SuggestionItem) => suggestionVars(s.data, locale, msg);

  async function act(s: SuggestionItem, action: "accept" | "dismiss") {
    setBusy(s.id);
    setError(null);
    try {
      const res = await api<{ suggestion: SuggestionItem }>(`/api/suggestions/${s.id}`, { body: { action } });
      setItems((list) => list.map((x) => (x.id === s.id ? res.suggestion : x)));
      if (action === "accept") setJustAccepted((set) => new Set(set).add(s.id));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="glass fade-in mb-6 px-5 py-4" data-testid="weekly-suggestions" aria-labelledby="suggestions-heading">
      <h2 id="suggestions-heading" className="flex items-center gap-2 font-semibold">
        <Lightbulb size={16} className="text-accent-ink" /> {t("title")}
      </h2>
      <p className="mt-0.5 text-xs text-muted">{t("hint")}</p>
      <ul className="mt-3 space-y-2">
        {visible.map((s) => {
          const title = t(`kinds.${s.kind}.title`, vars(s));
          const accepted = s.status === "ACCEPTED";
          return (
            <li key={s.id} className="flex flex-wrap items-center gap-3 rounded-xl border bg-bg/30 px-3 py-2.5" data-testid="suggestion">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {s.projectId ? (
                    <Link href={`/projects/${s.projectId}`} className="hover:text-accent-ink">{title}</Link>
                  ) : (
                    title
                  )}
                </p>
                <p className="text-xs text-muted">{t(`kinds.${s.kind}.detail`, vars(s))}</p>
              </div>
              {accepted ? (
                <span className="inline-flex items-center gap-2 text-xs text-emerald-400">
                  <Check size={14} /> {t("accepted")}
                  {s.kind === "overdue" ? (
                    <Link href="/today" className="text-accent-ink hover:underline">{t("toToday")}</Link>
                  ) : (
                    s.projectId && <Link href={`/projects/${s.projectId}`} className="text-accent-ink hover:underline">{t("openProject")}</Link>
                  )}
                </span>
              ) : (
                <div className="flex shrink-0 gap-2">
                  <button type="button" className="btn btn-primary btn-sm" disabled={busy === s.id} onClick={() => void act(s, "accept")}>
                    <Check size={14} /> {t("accept")}
                  </button>
                  <button type="button" className="btn btn-ghost btn-icon btn-sm" disabled={busy === s.id} onClick={() => void act(s, "dismiss")} aria-label={t("dismissLabel", { title })} title={t("dismiss")}>
                    <X size={15} />
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <FormError message={error} />
    </section>
  );
}
