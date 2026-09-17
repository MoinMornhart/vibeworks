"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { browserSupportsWebAuthn, startAuthentication } from "@simplewebauthn/browser";
import { ArrowLeft, Fingerprint, LogIn, ShieldCheck } from "lucide-react";
import { api, ApiClientError, errorMessage } from "@/lib/client/api";
import { FormError } from "@/components/ui/FormError";
import { useT } from "@/lib/i18n/client";

export function LoginForm({ next, allowRegistration, allowReset }: { next: string; allowRegistration: boolean; allowReset?: boolean }) {
  const t = useT("auth");
  const [step, setStep] = useState<"password" | "mfa">("password");
  // Zweiter Faktor: App, Wiederherstellungscode oder Code per E-Mail (#109)
  const [way, setWay] = useState<"app" | "recovery" | "email">("app");
  const [emailSent, setEmailSent] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [passkeys, setPasskeys] = useState(false);

  // Passkeys brauchen einen sicheren Kontext (HTTPS oder localhost).
  useEffect(() => {
    setPasskeys(browserSupportsWebAuthn() && window.isSecureContext);
  }, []);

  async function passkeyLogin() {
    setBusy(true);
    setError(null);
    try {
      const { options } = await api<{ options: Parameters<typeof startAuthentication>[0]["optionsJSON"] }>("/api/auth/passkey/login/options", { body: {} });
      const response = await startAuthentication({ optionsJSON: options });
      await api("/api/auth/passkey/login/verify", { body: { response } });
      window.location.assign(next);
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error && err.name === "NotAllowedError"
            ? t("login.passkeyCancelled")
            : errorMessage(err),
      );
      setBusy(false);
    }
  }

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ ok?: boolean; mfa?: boolean }>("/api/auth/login", { body: { username, password } });
      if (res.mfa) {
        setStep("mfa");
        setPassword("");
        setBusy(false);
        return;
      }
      // Volles Neuladen, damit das persönliche Design des Kontos greift.
      window.location.assign(next);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/mfa", { body: way === "recovery" ? { recoveryCode: code } : way === "email" ? { emailCode: code } : { code } });
      window.location.assign(next);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
      // Abgelaufen oder zu viele Versuche: zurück zum Passwort
      if (err instanceof ApiClientError && err.status === 401 && [t("errors.mfaExpired"), t("errors.mfaTooMany")].includes(err.message)) {
        setStep("password");
        setCode("");
      }
    }
  }

  /** Notfall-Code an die hinterlegte Adresse schicken */
  async function requestEmailCode() {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ minutes: number }>("/api/auth/mfa/email", { body: {} });
      setWay("email");
      setCode("");
      setEmailSent(t("mfa.emailSent"));
      void res;
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (step === "mfa") {
    return (
      <form onSubmit={submitCode} className="space-y-4">
        <p className="flex items-start gap-2 text-sm text-muted">
          <ShieldCheck size={18} className="mt-0.5 shrink-0 text-accent-ink" />
          {way === "recovery" ? t("mfa.hintRecovery") : way === "email" ? t("mfa.hintEmail", { n: 10 }) : t("mfa.hintApp")}
        </p>
        {emailSent && way === "email" && (
          <p role="status" className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300" data-testid="mfa-email-sent">
            {emailSent}
          </p>
        )}
        {way === "recovery" ? (
          <input className="field text-center font-mono tracking-widest" placeholder="xxxxx-xxxxx" value={code} onChange={(e) => setCode(e.target.value)} autoFocus aria-label={t("mfa.recoveryLabel")} autoComplete="off" />
        ) : (
          <input
            className="field text-center font-mono text-2xl tracking-[0.4em]"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            autoFocus
            aria-label={way === "email" ? t("mfa.emailLabel") : t("mfa.appCodeLabel")}
            data-testid={way === "email" ? "mfa-email-code" : "mfa-app-code"}
          />
        )}
        <FormError message={error} />
        <button className="btn btn-primary w-full" disabled={busy || (way === "recovery" ? !code.trim() : code.length !== 6)}>
          <ShieldCheck size={16} /> {busy ? t("mfa.checking") : t("mfa.confirm")}
        </button>
        <div className="flex flex-wrap justify-between gap-2 text-sm">
          <button type="button" className="inline-flex items-center gap-1 text-muted hover:text-fg" onClick={() => { setStep("password"); setCode(""); setError(null); }}>
            <ArrowLeft size={14} /> {t("mfa.back")}
          </button>
          <span className="flex flex-wrap gap-3">
            {way !== "app" && (
              <button type="button" className="text-accent-ink hover:underline" onClick={() => { setWay("app"); setCode(""); setError(null); }}>
                {t("mfa.useApp")}
              </button>
            )}
            {way !== "recovery" && (
              <button type="button" className="text-accent-ink hover:underline" onClick={() => { setWay("recovery"); setCode(""); setError(null); }} data-testid="mfa-use-recovery">
                {t("mfa.useRecovery")}
              </button>
            )}
            {way !== "email" && (
              <button type="button" className="text-accent-ink hover:underline" disabled={busy} onClick={() => void requestEmailCode()} data-testid="mfa-use-email">
                {t("mfa.useEmail")}
              </button>
            )}
          </span>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={submitPassword} className="space-y-4">
      <div>
        <label className="label" htmlFor="username">{t("form.username")}</label>
        <input id="username" className="field" autoComplete="username" autoFocus value={username} onChange={(e) => setUsername(e.target.value)} required />
      </div>
      <div>
        <label className="label" htmlFor="password">{t("form.password")}</label>
        <input id="password" type="password" className="field" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>
      <FormError message={error} />
      <button className="btn btn-primary w-full" disabled={busy}>
        <LogIn size={16} /> {busy ? t("login.submitting") : t("login.submit")}
      </button>
      {passkeys && (
        <>
          <div className="flex items-center gap-3 text-xs text-muted" aria-hidden>
            <span className="h-px flex-1 bg-fg/15" /> {t("login.or")} <span className="h-px flex-1 bg-fg/15" />
          </div>
          <button type="button" className="btn w-full" onClick={passkeyLogin} disabled={busy}>
            <Fingerprint size={16} /> {t("login.passkey")}
          </button>
        </>
      )}
      {allowReset && (
        <p className="text-center text-sm">
          <Link href="/reset" className="text-accent-ink hover:underline" data-testid="forgot-link">{t("login.forgot")}</Link>
        </p>
      )}
      {allowRegistration && (
        <p className="text-center text-sm text-muted">
          {t("login.noAccount")} <Link href="/register" className="text-accent-ink hover:underline">{t("login.register")}</Link>
        </p>
      )}
    </form>
  );
}
