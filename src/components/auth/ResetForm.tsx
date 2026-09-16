"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, KeyRound, Mail, UserCog } from "lucide-react";
import { api, ApiClientError, errorMessage } from "@/lib/client/api";
import { FormError } from "@/components/ui/FormError";
import { hasSpecial, PASSWORD_MIN } from "@/lib/auth/passwordRules";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

/**
 * Passwort vergessen. Drei Wege, je nach Lage:
 * mit gültigem Link ein neues Passwort setzen, sonst einen Link anfordern –
 * und immer die Möglichkeit, den Admin um ein neues Passwort zu bitten (#43).
 */
export function ResetForm({ token, valid, username, allowed }: { token: string; valid: boolean; username: string | null; allowed: boolean }) {
  const t = useT("auth");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [asked, setAsked] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function send(path: string, body: Record<string, unknown>, mark: () => void) {
    setBusy(true);
    setError(null);
    try {
      await api(path, { body });
      mark();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    if (password !== confirm) {
      setFieldErrors({ confirm: t("reset.mismatch") });
      return;
    }
    setBusy(true);
    try {
      await api("/api/auth/reset/confirm", { body: { token, password } });
      setDone(true);
    } catch (err) {
      if (err instanceof ApiClientError) setFieldErrors(err.fieldErrors);
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const backToLogin = (
    <p className="text-center text-sm">
      <Link href="/login" className="inline-flex items-center gap-1 text-muted hover:text-fg">
        <ArrowLeft size={14} /> {t("reset.backToLogin")}
      </Link>
    </p>
  );
  const good = (text: string, testId: string) => (
    <p className="flex items-start gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400" role="status" data-testid={testId}>
      <Check size={16} className="mt-0.5 shrink-0" /> {text}
    </p>
  );

  if (done) {
    return (
      <div className="space-y-4">
        {good(t("reset.done"), "reset-done")}
        {backToLogin}
      </div>
    );
  }

  // Mit Link aus der E-Mail: neues Passwort setzen
  if (token && allowed) {
    if (!valid) {
      return (
        <div className="space-y-4" data-testid="reset-invalid">
          <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-400">{t("reset.invalid")}</p>
          {backToLogin}
        </div>
      );
    }
    const rules = [
      { ok: password.length >= PASSWORD_MIN, label: t("reset.ruleLength", { n: PASSWORD_MIN }) },
      { ok: hasSpecial(password), label: t("reset.ruleSpecial") },
    ];
    return (
      <form onSubmit={submit} className="space-y-4" data-testid="reset-set">
        {username && <p className="text-sm text-muted">{t("reset.forUser", { name: username })}</p>}
        <div>
          <label className="label" htmlFor="reset-pw">{t("reset.newPassword")}</label>
          <input id="reset-pw" type="password" className="field" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus />
          {fieldErrors.password && <p className="mt-1 text-xs text-red-400">{fieldErrors.password}</p>}
        </div>
        <div>
          <label className="label" htmlFor="reset-confirm">{t("reset.repeat")}</label>
          <input id="reset-confirm" type="password" className="field" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          {fieldErrors.confirm && <p className="mt-1 text-xs text-red-400">{fieldErrors.confirm}</p>}
        </div>
        {password && (
          <ul className="space-y-1 text-xs" aria-live="polite">
            {rules.map((r) => (
              <li key={r.label} className={cn(r.ok ? "text-emerald-400" : "text-muted")}>
                {r.ok ? "✓" : "○"} {r.label}
              </li>
            ))}
          </ul>
        )}
        <FormError message={error} />
        <button className="btn btn-primary w-full" disabled={busy}>
          <KeyRound size={16} /> {busy ? t("reset.saving") : t("reset.save")}
        </button>
        {backToLogin}
      </form>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void send("/api/auth/reset", { login: login.trim() }, () => setSent(true));
      }}
      className="space-y-4"
      data-testid="reset-request"
    >
      {asked ? (
        good(t("reset.asked"), "reset-asked")
      ) : sent ? (
        good(t("reset.sent"), "reset-sent")
      ) : (
        <>
          {!allowed && (
            <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-300" data-testid="reset-off">
              {t("reset.off")}
            </p>
          )}
          <div>
            <label className="label" htmlFor="reset-login">{t("reset.loginLabel")}</label>
            <input id="reset-login" className="field" autoComplete="username" value={login} onChange={(e) => setLogin(e.target.value)} required autoFocus />
            <p className="mt-1 text-xs text-muted">{allowed ? t("reset.hint") : t("reset.hintAskOnly")}</p>
          </div>
          <FormError message={error} />
          {allowed && (
            <button className="btn btn-primary w-full" disabled={busy || !login.trim()}>
              <Mail size={16} /> {busy ? t("reset.sending") : t("reset.request")}
            </button>
          )}
          {/* Ohne E-Mail im Konto bleibt der kurze Weg: Admin setzt ein neues Passwort (#43) */}
          <button
            type="button"
            className={cn("w-full", allowed ? "btn btn-ghost" : "btn btn-primary")}
            disabled={busy || !login.trim()}
            data-testid="reset-ask"
            onClick={() => void send("/api/auth/reset/ask", { login: login.trim() }, () => setAsked(true))}
          >
            <UserCog size={16} /> {t("reset.ask")}
          </button>
        </>
      )}
      {backToLogin}
    </form>
  );
}
