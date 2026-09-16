"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { api, errorMessage } from "@/lib/client/api";
import { useT } from "@/lib/i18n/client";
import { toast } from "@/components/ui/Toaster";
import type { ApiTokenItem } from "@/lib/mcp/token";
import { KEY_SCOPES, REMINDER_MODES, type KeyScope, type ReminderMode } from "@/lib/mcp/keySettings";

/** Einstellungen je Schlüssel (#48/#49): Werkzeug-Umfang und Erinnerungen an die KI. */
export function KeySettings({ item, onSaved }: { item: ApiTokenItem; onSaved: (next: ApiTokenItem) => void }) {
  const t = useT("mcp");
  const [form, setForm] = useState({
    scope: item.scope as KeyScope,
    reminderMode: item.reminderMode as ReminderMode,
    reminderText: item.reminderText ?? "",
    reminderEvery: item.reminderEvery,
  });
  const [busy, setBusy] = useState(false);
  const dirty =
    form.scope !== item.scope || form.reminderMode !== item.reminderMode || form.reminderText !== (item.reminderText ?? "") || form.reminderEvery !== item.reminderEvery;

  async function save() {
    setBusy(true);
    try {
      const res = await api<{ item: ApiTokenItem }>(`/api/account/api-tokens/${item.id}`, { method: "PATCH", body: { ...form, reminderText: form.reminderText.trim() || null } });
      onSaved(res.item);
      toast(t("keySettings.saved"));
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="basis-full rounded-xl border bg-bg/25 px-3 py-2" data-testid="key-settings">
      <summary className="flex cursor-pointer items-center gap-2 text-xs text-muted">
        <SlidersHorizontal size={13} /> {t("keySettings.open")} ·{" "}
        {t("keySettings.summary", { scope: t(`keySettings.scope.${item.scope as KeyScope}`), reminder: t(`keySettings.reminder.${item.reminderMode as ReminderMode}`) })}
      </summary>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor={`scope-${item.id}`}>{t("keySettings.scopeLabel")}</label>
          <select id={`scope-${item.id}`} className="field" value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value as KeyScope })} data-testid="key-scope">
            {KEY_SCOPES.map((s) => (
              <option key={s} value={s}>{t(`keySettings.scope.${s}`)}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted">{t(`keySettings.scopeHint.${form.scope}`)}</p>
        </div>
        <div>
          <label className="label" htmlFor={`reminder-${item.id}`}>{t("keySettings.reminderLabel")}</label>
          <div className="flex gap-2">
            <select id={`reminder-${item.id}`} className="field" value={form.reminderMode} onChange={(e) => setForm({ ...form, reminderMode: e.target.value as ReminderMode })} data-testid="key-reminder">
              {REMINDER_MODES.map((m) => (
                <option key={m} value={m}>{t(`keySettings.reminder.${m}`)}</option>
              ))}
            </select>
            {form.reminderMode !== "off" && (
              <select className="field w-auto" aria-label={t("keySettings.everyLabel")} value={form.reminderEvery} onChange={(e) => setForm({ ...form, reminderEvery: Number(e.target.value) })} data-testid="key-every">
                {[1, 3, 5, 10, 20, 50].map((n) => (
                  <option key={n} value={n}>{t("keySettings.every", { n })}</option>
                ))}
              </select>
            )}
          </div>
          <p className="mt-1 text-xs text-muted">{t("keySettings.reminderHint")}</p>
          {form.reminderMode === "default" && <p className="mt-1 text-xs text-muted">{t("keySettings.defaultText")}</p>}
          {form.reminderMode === "custom" && (
            <textarea
              className="field mt-2 min-h-16 text-sm"
              maxLength={1000}
              placeholder={t("keySettings.textPlaceholder")}
              value={form.reminderText}
              onChange={(e) => setForm({ ...form, reminderText: e.target.value })}
              data-testid="key-reminder-text"
            />
          )}
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <button type="button" className="btn btn-primary btn-sm" disabled={busy || !dirty} onClick={() => void save()} data-testid="key-save">
          {t("keySettings.save")}
        </button>
      </div>
    </details>
  );
}
