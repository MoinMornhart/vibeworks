"use client";

import { useState } from "react";
import { ClipboardCopy, Download, KeyRound, RefreshCw, ShieldCheck, ShieldOff, Smartphone } from "lucide-react";
import { FormError } from "@/components/ui/FormError";
import { api, ApiClientError, errorMessage } from "@/lib/client/api";
import { useT } from "@/lib/i18n/client";
import { AccountSection } from "./AccountManager";

type Mode = "idle" | "setup" | "codes" | "confirm-disable" | "confirm-regenerate";

function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const t = useT("account");
  const tc = useT("common");
  const [saved, setSaved] = useState(false);
  const text = `${t("totp.codesFileHeader")}\n\n${codes.join("\n")}\n`;

  function download() {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = t("totp.codesFileName");
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
        {t("totp.codesOnceBefore")}<strong>{t("totp.codesOnceStrong")}</strong>{t("totp.codesOnceAfter")}
      </p>
      <ol className="grid grid-cols-2 gap-2 font-mono text-sm sm:grid-cols-5">
        {codes.map((c) => (
          <li key={c} className="rounded-lg border bg-bg/40 px-2 py-1.5 text-center tracking-wider">{c}</li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-sm" onClick={() => void navigator.clipboard?.writeText(text)}><ClipboardCopy size={14} /> {tc("copy")}</button>
        <button type="button" className="btn btn-sm" onClick={download}><Download size={14} /> {t("totp.saveAsFile")}</button>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} className="accent-[var(--vw-accent)]" />
        {t("totp.savedConfirm")}
      </label>
      <button type="button" className="btn btn-primary btn-sm" disabled={!saved} onClick={onDone}>{t("totp.done")}</button>
    </div>
  );
}

export function TotpSection({ initial, hasPassword }: { initial: { enabled: boolean; recoveryLeft: number }; hasPassword: boolean }) {
  const t = useT("account");
  const tc = useT("common");
  const [enabled, setEnabled] = useState(initial.enabled);
  const [recoveryLeft, setRecoveryLeft] = useState(initial.recoveryLeft);
  const [mode, setMode] = useState<Mode>("idle");
  const [setup, setSetup] = useState<{ secret: string; qr: string } | null>(null);
  const [codes, setCodes] = useState<string[]>([]);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset(next: Mode = "idle") {
    setMode(next);
    setCode("");
    setPassword("");
    setError(null);
  }

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const startSetup = () =>
    run(async () => {
      setSetup(await api<{ secret: string; qr: string }>("/api/account/totp", { body: {} }));
      reset("setup");
    });

  const activate = (e: React.FormEvent) => {
    e.preventDefault();
    return run(async () => {
      const res = await api<{ codes: string[] }>("/api/account/totp", { method: "PUT", body: { code } });
      setEnabled(true);
      setRecoveryLeft(res.codes.length);
      setCodes(res.codes);
      setSetup(null);
      reset("codes");
    });
  };

  const confirm = (e: React.FormEvent) => {
    e.preventDefault();
    const body = hasPassword ? { password } : { code };
    return run(async () => {
      if (mode === "confirm-disable") {
        await api("/api/account/totp", { method: "DELETE", body });
        setEnabled(false);
        setRecoveryLeft(0);
        reset();
      } else {
        const res = await api<{ codes: string[] }>("/api/account/totp/recovery", { body });
        setCodes(res.codes);
        setRecoveryLeft(res.codes.length);
        reset("codes");
      }
    });
  };

  return (
    <AccountSection icon={<ShieldCheck size={18} />} title={t("totp.title")} description={t("totp.description")}>
      {mode === "codes" ? (
        <RecoveryCodes codes={codes} onDone={() => reset()} />
      ) : mode === "setup" && setup ? (
        <form onSubmit={activate} className="space-y-4">
          <div className="flex flex-wrap items-start gap-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={setup.qr} alt={t("totp.qrAlt")} width={200} height={200} className="rounded-xl bg-white p-2" />
            <div className="min-w-0 flex-1 space-y-3 text-sm">
              <p><strong>1.</strong> {t("totp.step1")}</p>
              <p className="text-muted">{t("totp.manualKey")}</p>
              <p className="break-all rounded-lg border bg-bg/40 px-3 py-2 font-mono tracking-wider">{setup.secret.match(/.{1,4}/g)?.join(" ")}</p>
              <p><strong>2.</strong> {t("totp.step2")}</p>
              <input
                className="field max-w-40 text-center font-mono text-lg tracking-[0.3em]"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                aria-label={t("totp.codeLabel")}
                autoFocus
              />
            </div>
          </div>
          <FormError message={error} />
          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary btn-sm" disabled={busy || code.length !== 6}><ShieldCheck size={14} /> {t("totp.activate")}</button>
            <button type="button" className="btn btn-sm" onClick={() => reset()}>{tc("cancel")}</button>
          </div>
        </form>
      ) : mode === "confirm-disable" || mode === "confirm-regenerate" ? (
        <form onSubmit={confirm} className="space-y-3">
          <p className="text-sm">{mode === "confirm-disable" ? t("totp.confirmDisable") : t("totp.confirmRegenerate")}</p>
          {hasPassword ? (
            <input type="password" className="field max-w-sm" placeholder={t("totp.passwordPlaceholder")} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" aria-label={t("totp.passwordPlaceholder")} autoFocus />
          ) : (
            <input className="field max-w-40 text-center font-mono" inputMode="numeric" maxLength={6} placeholder={t("totp.codePlaceholder")} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} aria-label={t("totp.codeLabel")} autoFocus />
          )}
          <FormError message={error} />
          <div className="flex gap-2">
            <button type="submit" className={mode === "confirm-disable" ? "btn btn-danger btn-sm" : "btn btn-primary btn-sm"} disabled={busy}>
              {mode === "confirm-disable" ? <><ShieldOff size={14} /> {t("totp.disable")}</> : <><RefreshCw size={14} /> {t("totp.regenerate")}</>}
            </button>
            <button type="button" className="btn btn-sm" onClick={() => reset()}>{tc("cancel")}</button>
          </div>
        </form>
      ) : enabled ? (
        <div className="space-y-4">
          <p className="flex items-center gap-2 text-sm">
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-400">{t("totp.active")}</span>
            <span className={recoveryLeft <= 2 ? "text-amber-400" : "text-muted"}>
              {t("totp.codesLeft", { n: recoveryLeft })}{recoveryLeft <= 2 && t("totp.codesLow")}
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-sm" onClick={() => reset("confirm-regenerate")}><KeyRound size={14} /> {t("totp.newCodes")}</button>
            <button className="btn btn-danger btn-sm" onClick={() => reset("confirm-disable")}><ShieldOff size={14} /> {t("totp.disable")}</button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted">{t("totp.notSetUp")}</p>
          <FormError message={error} />
          <button className="btn btn-primary btn-sm" onClick={startSetup} disabled={busy}><Smartphone size={14} /> {t("totp.setUp")}</button>
        </div>
      )}
    </AccountSection>
  );
}
