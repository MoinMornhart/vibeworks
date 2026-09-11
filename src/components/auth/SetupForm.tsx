"use client";

import { useState } from "react";
import { User, Users, Rocket } from "lucide-react";
import { api, ApiClientError, errorMessage } from "@/lib/client/api";
import { cn } from "@/lib/utils";
import { FormError } from "@/components/ui/FormError";
import { GitTokenOptional } from "./GitTokenOptional";
import { EMPTY_GIT_CONNECTION, type GitConnectionForm } from "@/components/git/GitProviderFields";
import { useT } from "@/lib/i18n/client";

export function SetupForm() {
  const t = useT("auth");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [mode, setMode] = useState<"SINGLE" | "MULTI">("SINGLE");
  const [allowRegistration, setAllowRegistration] = useState(false);
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
      await api("/api/auth/setup", { body: { username, displayName, password, mode, allowRegistration, gitToken: git.token, gitProvider: git.provider, gitServer: git.server } });
      window.location.assign("/");
    } catch (err) {
      if (err instanceof ApiClientError) setFieldErrors(err.fieldErrors);
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  const modes = [
    { value: "SINGLE" as const, icon: User, title: t("setup.singleTitle"), text: t("setup.singleText") },
    { value: "MULTI" as const, icon: Users, title: t("setup.multiTitle"), text: t("setup.multiText") },
  ];

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="username">{t("form.username")}</label>
          <input id="username" className="field" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus />
          {fieldErrors.username && <p className="mt-1 text-xs text-red-400">{fieldErrors.username}</p>}
        </div>
        <div>
          <label className="label" htmlFor="displayName">{t("form.displayName")} <span className="opacity-70">{t("form.optional")}</span></label>
          <input id="displayName" className="field" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="password">{t("form.password")}</label>
        <input id="password" type="password" className="field" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <p className={cn("mt-1 text-xs", fieldErrors.password ? "text-red-400" : "text-muted")}>
          {fieldErrors.password ?? t("setup.passwordHint")}
        </p>
      </div>
      <div>
        <label className="label" htmlFor="confirm">{t("form.passwordRepeat")}</label>
        <input id="confirm" type="password" className="field" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        {fieldErrors.confirm && <p className="mt-1 text-xs text-red-400">{fieldErrors.confirm}</p>}
      </div>

      <fieldset>
        <legend className="label">{t("setup.mode")}</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {modes.map((m) => (
            <label
              key={m.value}
              className={cn(
                "cursor-pointer rounded-xl border p-3 transition-colors",
                mode === m.value ? "border-accent bg-accent/10" : "hover:border-accent/50",
              )}
            >
              <input type="radio" name="mode" value={m.value} checked={mode === m.value} onChange={() => setMode(m.value)} className="sr-only" />
              <span className="flex items-center gap-2 font-medium"><m.icon size={16} /> {m.title}</span>
              <span className="mt-1 block text-xs text-muted">{m.text}</span>
            </label>
          ))}
        </div>
        {mode === "MULTI" && (
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={allowRegistration} onChange={(e) => setAllowRegistration(e.target.checked)} className="accent-[var(--vw-accent)]" />
            {t("setup.allowRegistration")}
          </label>
        )}
        <p className="mt-2 text-xs text-muted">{t("setup.changeLater")}</p>
      </fieldset>

      <GitTokenOptional value={git} onChange={setGit} error={fieldErrors.gitToken} />
      <FormError message={error} />
      <button className="btn btn-primary w-full" disabled={busy}>
        <Rocket size={16} /> {busy ? t("setup.submitting") : t("setup.submit")}
      </button>
    </form>
  );
}
