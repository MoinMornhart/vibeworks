"use client";

import { useState } from "react";
import Link from "next/link";
import { UserPlus } from "lucide-react";
import { api, ApiClientError, errorMessage } from "@/lib/client/api";
import { FormError } from "@/components/ui/FormError";
import { GitTokenOptional } from "./GitTokenOptional";
import { EMPTY_GIT_CONNECTION, type GitConnectionForm } from "@/components/git/GitProviderFields";
import { useT } from "@/lib/i18n/client";

export function RegisterForm() {
  const t = useT("auth");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [git, setGit] = useState<GitConnectionForm>(EMPTY_GIT_CONNECTION);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    if (password !== confirm) {
      setFieldErrors({ confirm: t("form.passwordMismatch") });
      return;
    }
    setBusy(true);
    try {
      await api("/api/auth/register", { body: { username, displayName, password, gitToken: git.token, gitProvider: git.provider, gitServer: git.server } });
      window.location.assign("/");
    } catch (err) {
      if (err instanceof ApiClientError) setFieldErrors(err.fieldErrors);
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label" htmlFor="username">{t("form.username")}</label>
        <input id="username" className="field" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus />
        {fieldErrors.username && <p className="mt-1 text-xs text-red-400">{fieldErrors.username}</p>}
      </div>
      <div>
        <label className="label" htmlFor="displayName">{t("form.displayName")} <span className="opacity-70">{t("form.optional")}</span></label>
        <input id="displayName" className="field" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="password">{t("form.password")}</label>
        <input id="password" type="password" className="field" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {fieldErrors.password && <p className="mt-1 text-xs text-red-400">{fieldErrors.password}</p>}
      </div>
      <div>
        <label className="label" htmlFor="confirm">{t("form.passwordRepeat")}</label>
        <input id="confirm" type="password" className="field" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        {fieldErrors.confirm && <p className="mt-1 text-xs text-red-400">{fieldErrors.confirm}</p>}
      </div>
      <GitTokenOptional value={git} onChange={setGit} error={fieldErrors.gitToken} />
      <FormError message={error} />
      <button className="btn btn-primary w-full" disabled={busy}>
        <UserPlus size={16} /> {busy ? t("register.submitting") : t("register.submit")}
      </button>
      <p className="text-center text-sm text-muted">
        {t("register.haveAccount")} <Link href="/login" className="text-accent-ink hover:underline">{t("register.login")}</Link>
      </p>
    </form>
  );
}
