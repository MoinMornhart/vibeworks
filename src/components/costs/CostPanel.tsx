"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarClock, Pencil, Plus, Trash2, Wallet } from "lucide-react";
import { FormError } from "@/components/ui/FormError";
import { api, ApiClientError, errorMessage } from "@/lib/client/api";
import { useFormat, useLocale, useT } from "@/lib/i18n/client";
import { costTotals, CURRENCIES, formatMoney, INTERVALS, nextRenewal, RENEWAL_WARN_DAYS, type CostInterval, type CostItem } from "@/lib/costs";
import { diffDays } from "@/lib/taskDates";
import { cn } from "@/lib/utils";

type Form = { name: string; amount: string; currency: string; interval: CostInterval; renewsOn: string; note: string };
const EMPTY: Form = { name: "", amount: "", currency: "EUR", interval: "MONTHLY", renewsOn: "", note: "" };

/** Verlängerung als kleines Etikett – rot, wenn fällig, gelb in den nächsten zwei Wochen. */
export function RenewalBadge({ cost, today }: { cost: Pick<CostItem, "renewsOn" | "interval">; today: string }) {
  const t = useT("costs");
  const f = useFormat();
  const next = nextRenewal(cost.renewsOn, cost.interval, today);
  if (!next) return null;
  const days = diffDays(today, next);
  const text =
    cost.interval === "ONCE"
      ? t("paidOn", { date: f.date(next) })
      : days === 0
        ? t("renewsToday")
        : days <= RENEWAL_WARN_DAYS
          ? t("renewsSoon", { n: days })
          : t("renews", { date: f.date(next) });
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 text-[11px]",
        cost.interval !== "ONCE" && days <= 3 ? "border-red-500/40 bg-red-500/10 text-red-400" : cost.interval !== "ONCE" && days <= RENEWAL_WARN_DAYS ? "border-amber-500/40 bg-amber-500/10 text-amber-400" : "text-muted",
      )}
      suppressHydrationWarning
    >
      <CalendarClock size={11} /> {text}
    </span>
  );
}

export function CostTotalsLine({ costs }: { costs: CostItem[] }) {
  const t = useT("costs");
  const locale = useLocale();
  return (
    <span className="text-sm text-muted" data-testid="cost-totals">
      {costTotals(costs)
        .map((x) =>
          [
            x.monthly || x.yearly ? `${t("perMonth", { amount: formatMoney(x.monthly, x.currency, locale) })} · ${t("perYear", { amount: formatMoney(x.yearly, x.currency, locale) })}` : null,
            x.once ? t("once", { amount: formatMoney(x.once, x.currency, locale) }) : null,
          ]
            .filter(Boolean)
            .join(" · "),
        )
        .join("  |  ")}
    </span>
  );
}

/** Kosten am Projekt: Liste, Summen, anlegen und bearbeiten. */
export function CostPanel({ projectId, initial, today, canEdit }: { projectId: string; initial: CostItem[]; today: string; canEdit: boolean }) {
  const t = useT("costs");
  const locale = useLocale();
  const [costs, setCosts] = useState(initial);
  const [editing, setEditing] = useState<CostItem | "new" | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  if (!canEdit && costs.length === 0) return null;

  function open(c: CostItem | "new") {
    setEditing(c);
    setError(null);
    setFieldErrors({});
    setForm(
      c === "new"
        ? EMPTY
        : { name: c.name, amount: (c.amountCents / 100).toFixed(2).replace(".", locale === "de" ? "," : "."), currency: c.currency, interval: c.interval, renewsOn: c.renewsOn ?? "", note: c.note ?? "" },
    );
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      const body = { ...form, renewsOn: form.renewsOn || null, note: form.note || null };
      const res =
        editing === "new"
          ? await api<{ cost: CostItem }>(`/api/projects/${projectId}/costs`, { body })
          : await api<{ cost: CostItem }>(`/api/costs/${editing.id}`, { method: "PATCH", body });
      setCosts((list) => (editing === "new" ? [...list, res.cost] : list.map((x) => (x.id === res.cost.id ? res.cost : x))));
      setEditing(null);
    } catch (err) {
      if (err instanceof ApiClientError) setFieldErrors(err.fieldErrors);
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(c: CostItem) {
    if (!window.confirm(t("confirmDelete", { name: c.name }))) return;
    try {
      await api(`/api/costs/${c.id}`, { method: "DELETE" });
      setCosts((list) => list.filter((x) => x.id !== c.id));
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <section className="glass p-6 sm:p-8" aria-labelledby="costs-heading">
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 id="costs-heading" className="flex items-center gap-2 text-lg font-semibold"><Wallet size={18} className="text-emerald-400" /> {t("title")}</h2>
        {costs.length > 0 && <CostTotalsLine costs={costs} />}
        <div className="ml-auto flex gap-2">
          <Link href="/costs" className="btn btn-ghost btn-sm">{t("all")}</Link>
          {canEdit && editing === null && <button className="btn btn-sm" onClick={() => open("new")}><Plus size={14} /> {t("add")}</button>}
        </div>
      </div>

      {costs.length === 0 && editing === null && <p className="text-sm text-muted">{t("empty")}</p>}
      {costs.length > 0 && (
        <ul className="divide-y divide-fg/10">
          {costs.map((c) => (
            <li key={c.id} data-testid="cost" className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{c.name}</p>
                {c.note && <p className="truncate text-xs text-muted">{c.note}</p>}
              </div>
              <RenewalBadge cost={c} today={today} />
              <span className="w-40 text-right tabular-nums">
                {formatMoney(c.amountCents, c.currency, locale)} <span className="text-xs text-muted">{t(`intervals.${c.interval}`)}</span>
              </span>
              {canEdit && (
                <span className="flex">
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={() => open(c)} aria-label={t("edit")} title={t("edit")}><Pencil size={14} /></button>
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={() => void remove(c)} aria-label={t("delete")} title={t("delete")}><Trash2 size={14} /></button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {editing !== null && (
        <form onSubmit={save} className="mt-4 space-y-3 rounded-xl border p-4" aria-label={t("add")}>
          <div className="grid gap-3 sm:grid-cols-[2fr_1fr_auto_auto]">
            <div>
              <label className="label" htmlFor="cost-name">{t("name")}</label>
              <input id="cost-name" className="field" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder={t("namePlaceholder")} maxLength={80} autoFocus />
              {fieldErrors.name && <p className="mt-1 text-xs text-red-400">{fieldErrors.name}</p>}
            </div>
            <div>
              <label className="label" htmlFor="cost-amount">{t("amount")}</label>
              <input id="cost-amount" className="field" inputMode="decimal" value={form.amount} onChange={(e) => set("amount", e.target.value)} placeholder="12,99" />
              {fieldErrors.amount && <p className="mt-1 text-xs text-red-400">{fieldErrors.amount}</p>}
            </div>
            <div>
              <label className="label" htmlFor="cost-currency">{t("currency")}</label>
              <select id="cost-currency" className="field" value={form.currency} onChange={(e) => set("currency", e.target.value)}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="cost-interval">{t("interval")}</label>
              <select id="cost-interval" className="field" value={form.interval} onChange={(e) => set("interval", e.target.value as CostInterval)}>
                {INTERVALS.map((i) => <option key={i} value={i}>{t(`intervals.${i}`)}</option>)}
              </select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
            <div>
              <label className="label" htmlFor="cost-renews">{form.interval === "ONCE" ? t("paidDate") : t("renewsOn")}</label>
              <input id="cost-renews" type="date" className="field" value={form.renewsOn} onChange={(e) => set("renewsOn", e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="cost-note">{t("note")}</label>
              <input id="cost-note" className="field" value={form.note} onChange={(e) => set("note", e.target.value)} maxLength={500} />
            </div>
          </div>
          <FormError message={error} />
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-sm" onClick={() => setEditing(null)}>{t("cancel")}</button>
            <button className="btn btn-primary btn-sm" disabled={busy}>{t("save")}</button>
          </div>
        </form>
      )}
    </section>
  );
}
