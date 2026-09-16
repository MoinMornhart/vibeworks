"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, KeyRound, Mail } from "lucide-react";
import { api, ApiClientError, errorMessage } from "@/lib/client/api";
import { FormError } from "@/components/ui/FormError";
import { hasSpecial, PASSWORD_MIN } from "@/lib/auth/passwordRules";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

/** Passwort vergessen: ohne Link die Anfrage, mit gültigem Link das neue Passwort. */
export function ResetForm({ token, valid, username }: { token: string; valid: boolean; username: string | null }) {
  const t = useT("auth");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function request(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/reset", { body: { login: login.trim() } });
      setSent(true);
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

  if (done) {
    return (
      <div className="space-y-4" data-testid="reset-done">
        <p className="flex items-start gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
          <Check size={16} className="mt-0.5 shrink-0" /> {t("reset.done")}
        </p>
        {backToLogin}
      </div>
    );
  }

  if (token) {
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
    <form onSubmit={request} className="space-y-4" data-testid="reset-request">
      {sent ? (
        <p className="flex items-start gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400" role="status" data-testid="reset-sent">
          <Mail size={16} className="mt-0.5 shrink-0" /> {t("reset.sent")}
        </p>
      ) : (
        <>
          <div>
            <label className="label" htmlFor="reset-login">{t("reset.loginLabel")}</label>
            <input id="reset-login" className="field" autoComplete="username" value={login} onChange={(e) => setLogin(e.target.value)} required autoFocus />
            <p className="mt-1 text-xs text-muted">{t("reset.hint")}</p>
          </div>
          <FormError message={error} />
          <button className="btn btn-primary w-full" disabled={busy || !login.trim()}>
            <Mail size={16} /> {busy ? t("reset.sending") : t("reset.request")}
          </button>
        </>
      )}
      {backToLogin}
    </form>
  );
}
