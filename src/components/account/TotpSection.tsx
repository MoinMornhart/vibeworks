"use client";

import { useState } from "react";
import { ClipboardCopy, Download, KeyRound, RefreshCw, ShieldCheck, ShieldOff, Smartphone } from "lucide-react";
import { FormError } from "@/components/ui/FormError";
import { api, ApiClientError, errorMessage } from "@/lib/client/api";
import { AccountSection } from "./AccountManager";

type Mode = "idle" | "setup" | "codes" | "confirm-disable" | "confirm-regenerate";

function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const [saved, setSaved] = useState(false);
  const text = `VibeWorks – Wiederherstellungscodes\nJeder Code gilt genau einmal.\n\n${codes.join("\n")}\n`;

  function download() {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "vibeworks-wiederherstellungscodes.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
        Diese Codes werden <strong>nur jetzt</strong> angezeigt. Bewahre sie sicher auf – mit jedem kommst du einmal ohne Handy in dein Konto.
      </p>
      <ol className="grid grid-cols-2 gap-2 font-mono text-sm sm:grid-cols-5">
        {codes.map((c) => (
          <li key={c} className="rounded-lg border bg-bg/40 px-2 py-1.5 text-center tracking-wider">{c}</li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-sm" onClick={() => void navigator.clipboard?.writeText(text)}><ClipboardCopy size={14} /> Kopieren</button>
        <button type="button" className="btn btn-sm" onClick={download}><Download size={14} /> Als Datei speichern</button>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} className="accent-[var(--vw-accent)]" />
        Ich habe die Codes sicher aufbewahrt
      </label>
      <button type="button" className="btn btn-primary btn-sm" disabled={!saved} onClick={onDone}>Fertig</button>
    </div>
  );
}

export function TotpSection({ initial, hasPassword }: { initial: { enabled: boolean; recoveryLeft: number }; hasPassword: boolean }) {
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
    <AccountSection
      icon={<ShieldCheck size={18} />}
      title="Zwei-Faktor-Anmeldung"
      description="Zusätzlich zum Passwort ein Einmalcode aus einer Authenticator-App (z. B. Aegis, 2FAS, Google oder Microsoft Authenticator)."
    >
      {mode === "codes" ? (
        <RecoveryCodes codes={codes} onDone={() => reset()} />
      ) : mode === "setup" && setup ? (
        <form onSubmit={activate} className="space-y-4">
          <div className="flex flex-wrap items-start gap-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={setup.qr} alt="QR-Code für die Authenticator-App" width={200} height={200} className="rounded-xl bg-white p-2" />
            <div className="min-w-0 flex-1 space-y-3 text-sm">
              <p><strong>1.</strong> QR-Code mit der Authenticator-App scannen.</p>
              <p className="text-muted">Oder den Schlüssel von Hand eingeben:</p>
              <p className="break-all rounded-lg border bg-bg/40 px-3 py-2 font-mono tracking-wider">{setup.secret.match(/.{1,4}/g)?.join(" ")}</p>
              <p><strong>2.</strong> Den angezeigten 6-stelligen Code eintragen:</p>
              <input
                className="field max-w-40 text-center font-mono text-lg tracking-[0.3em]"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                aria-label="Code aus der App"
                autoFocus
              />
            </div>
          </div>
          <FormError message={error} />
          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary btn-sm" disabled={busy || code.length !== 6}><ShieldCheck size={14} /> Aktivieren</button>
            <button type="button" className="btn btn-sm" onClick={() => reset()}>Abbrechen</button>
          </div>
        </form>
      ) : mode === "confirm-disable" || mode === "confirm-regenerate" ? (
        <form onSubmit={confirm} className="space-y-3">
          <p className="text-sm">{mode === "confirm-disable" ? "Zum Abschalten bitte bestätigen." : "Neue Codes machen die bisherigen ungültig. Bitte bestätigen."}</p>
          {hasPassword ? (
            <input type="password" className="field max-w-sm" placeholder="Passwort" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" aria-label="Passwort" autoFocus />
          ) : (
            <input className="field max-w-40 text-center font-mono" inputMode="numeric" maxLength={6} placeholder="Code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} aria-label="Code aus der App" autoFocus />
          )}
          <FormError message={error} />
          <div className="flex gap-2">
            <button type="submit" className={mode === "confirm-disable" ? "btn btn-danger btn-sm" : "btn btn-primary btn-sm"} disabled={busy}>
              {mode === "confirm-disable" ? <><ShieldOff size={14} /> Abschalten</> : <><RefreshCw size={14} /> Neue Codes erzeugen</>}
            </button>
            <button type="button" className="btn btn-sm" onClick={() => reset()}>Abbrechen</button>
          </div>
        </form>
      ) : enabled ? (
        <div className="space-y-4">
          <p className="flex items-center gap-2 text-sm">
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-400">Aktiv</span>
            <span className={recoveryLeft <= 2 ? "text-amber-400" : "text-muted"}>
              {recoveryLeft} von 10 Wiederherstellungscodes übrig{recoveryLeft <= 2 && " – bald neue erzeugen"}
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-sm" onClick={() => reset("confirm-regenerate")}><KeyRound size={14} /> Neue Wiederherstellungscodes</button>
            <button className="btn btn-danger btn-sm" onClick={() => reset("confirm-disable")}><ShieldOff size={14} /> Abschalten</button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted">Nicht eingerichtet. Mit einem zweiten Faktor hilft ein erratenes oder abgefangenes Passwort allein nicht weiter.</p>
          <FormError message={error} />
          <button className="btn btn-primary btn-sm" onClick={startSetup} disabled={busy}><Smartphone size={14} /> Einrichten</button>
        </div>
      )}
    </AccountSection>
  );
}
