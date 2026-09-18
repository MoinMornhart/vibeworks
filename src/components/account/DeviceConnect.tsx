"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, ShieldAlert, XCircle } from "lucide-react";
import { api, errorMessage } from "@/lib/client/api";
import { useFormat, useT } from "@/lib/i18n/client";
import { KEY_SCOPES, type KeyScope } from "@/lib/mcp/keySettings";
import type { PendingDevice } from "@/lib/mcp/deviceAuth";

/** Freigabe einer Geräte-Anmeldung (#104): Code prüfen, Umfang wählen, bewusst bestätigen. */
export function DeviceConnect({ initialCode, initial }: { initialCode: string; initial: PendingDevice | null }) {
  const t = useT("mcp");
  const f = useFormat();
  const [code, setCode] = useState(initialCode);
  const [device, setDevice] = useState<PendingDevice | null>(initial);
  const [scope, setScope] = useState<KeyScope>(initial?.scope ?? "tasks");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(initialCode && !initial ? t("device.notFound") : null);
  const [done, setDone] = useState<"allowed" | "denied" | null>(null);

  async function check(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ device: PendingDevice | null }>(`/api/account/device?code=${encodeURIComponent(code)}`);
      setDevice(res.device);
      if (res.device) setScope(res.device.scope);
      else setError(t("device.notFound"));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function decide(approve: boolean) {
    if (!device) return;
    setBusy(true);
    setError(null);
    try {
      await api("/api/account/device", { body: { code: device.code, approve, scope } });
      setDone(approve ? "allowed" : "denied");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    if (typeof window !== "undefined") {
      setTimeout(() => {
        try {
          window.close();
          setTimeout(() => { window.location.href = "/account#mcp"; }, 500); // Fallback
        } catch (e) {
          window.location.href = "/account#mcp"; // Fallback if close is blocked
        }
      }, 5000);
    }
    return (
      <section className="glass p-6" role="status" data-testid="device-done" data-result={done}>
        <p className="flex items-start gap-2">
          {done === "allowed" ? <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-emerald-400" /> : <XCircle size={20} className="mt-0.5 shrink-0 text-muted" />}
          {t(`device.${done}`)}
        </p>
        <p className="mt-2 text-sm text-muted">{done === "allowed" ? t("device.autoCloseHint", { defaultValue: "Fenster schließt sich in 5 Sekunden..." }) : ""}</p>
        {done === "allowed" && (
          <div className="flex flex-wrap gap-2 mt-4">
            <Link href="/account#mcp" className="btn btn-sm">
              {t("section.title")}
            </Link>
            <button className="btn btn-sm" onClick={() => window.close()}>
              {t("device.closeWindow", { defaultValue: "Fenster schließen" })}
            </button>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="glass space-y-4 p-6" data-testid="device-connect">
      {!device && (
        <form onSubmit={check} className="flex flex-wrap items-end gap-2">
          <label className="min-w-0 flex-1 text-sm">
            <span className="mb-1 block text-xs text-muted">{t("device.codeLabel")}</span>
            <input
              className="field font-mono text-lg uppercase tracking-widest"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={t("device.codePlaceholder")}
              maxLength={12}
              autoComplete="off"
              autoFocus
              data-testid="device-code"
            />
          </label>
          <button type="submit" className="btn btn-primary" disabled={busy || code.trim().length < 8}>
            {t("device.check")}
          </button>
        </form>
      )}
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      {device && (
        <div className="space-y-4" data-testid="device-request">
          <div>
            <p className="font-semibold">{t("device.request", { name: device.clientName })}</p>
            <p className="mt-1 font-mono text-2xl tracking-widest" data-testid="device-shown-code">{device.code}</p>
            <p className="text-xs text-muted" suppressHydrationWarning>
              {device.ip ? t("device.from", { when: f.ago(device.createdAt), ip: device.ip }) : t("device.fromUnknown", { when: f.ago(device.createdAt) })}
            </p>
          </div>
          <p className="flex gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
            <ShieldAlert size={18} className="mt-0.5 shrink-0" /> {t("device.warn")}
          </p>
          <label className="block text-sm">
            <span className="mb-1 block text-xs text-muted">{t("device.scopeLabel")}</span>
            <select className="field" value={scope} onChange={(e) => setScope(e.target.value as KeyScope)} data-testid="device-scope">
              {KEY_SCOPES.map((s) => (
                <option key={s} value={s}>
                  {t(`keySettings.scope.${s}`)}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-muted">{t(`keySettings.scopeHint.${scope}`)}</span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} data-testid="device-confirm" />
            {t("device.confirm")}
          </label>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className="btn" onClick={() => void decide(false)} disabled={busy} data-testid="device-deny">
              {t("device.deny")}
            </button>
            <button type="button" className="btn btn-primary" onClick={() => void decide(true)} disabled={busy || !confirmed} data-testid="device-allow">
              {t("device.allow")}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
