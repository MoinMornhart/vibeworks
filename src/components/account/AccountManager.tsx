"use client";

import { useState, type ReactNode } from "react";
import { KeyRound, LogOut, Monitor, Save, ShieldCheck, Smartphone, UserRound } from "lucide-react";
import { FormError } from "@/components/ui/FormError";
import type { SessionItem } from "@/lib/account";
import { api, ApiClientError, errorMessage } from "@/lib/client/api";
import { useFormat, useT } from "@/lib/i18n/client";

export interface AccountProfile {
  username: string;
  displayName: string | null;
  email: string | null;
  hasPassword: boolean;
  role: "ADMIN" | "USER";
  createdAt: string;
}

export function AccountSection({ icon, title, description, children }: { icon: ReactNode; title: string; description?: string; children: ReactNode }) {
  return (
    <section className="glass p-6 sm:p-8">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <span className="text-accent-ink">{icon}</span> {title}
      </h2>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Notice({ text }: { text: string | null }) {
  if (!text) return null;
  return <p role="status" className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">{text}</p>;
}

function ProfileForm({ profile }: { profile: AccountProfile }) {
  const t = useT("account");
  const tc = useT("common");
  const [displayName, setDisplayName] = useState(profile.displayName ?? "");
  const [email, setEmail] = useState(profile.email ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await api("/api/account/profile", { method: "PATCH", body: { displayName, email } });
      setNotice(t("profile.saved"));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <span className="label">{t("profile.username")}</span>
          <p className="field flex items-center text-muted">{profile.username}</p>
        </div>
        <div>
          <label className="label" htmlFor="a-display">{t("profile.displayName")}</label>
          <input id="a-display" className="field" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={60} placeholder={profile.username} />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="a-email">{t("profile.email")} <span className="opacity-70">({tc("optional")})</span></label>
          <input id="a-email" type="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} autoComplete="email" />
        </div>
      </div>
      <FormError message={error} />
      <Notice text={notice} />
      <button className="btn btn-primary btn-sm" disabled={busy}><Save size={14} /> {busy ? tc("saving") : t("profile.save")}</button>
    </form>
  );
}

function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const t = useT("account");
  const tc = useT("common");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setFieldErrors({});
    if (next !== confirm) {
      setFieldErrors({ confirm: t("password.mismatch") });
      return;
    }
    setBusy(true);
    try {
      await api("/api/account/password", { body: { currentPassword: current || undefined, newPassword: next } });
      setCurrent("");
      setNext("");
      setConfirm("");
      setNotice(t("password.changed"));
    } catch (err) {
      if (err instanceof ApiClientError) setFieldErrors(err.fieldErrors);
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {hasPassword && (
        <div className="max-w-sm">
          <label className="label" htmlFor="pw-current">{t("password.current")}</label>
          <input id="pw-current" type="password" className="field" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
          {fieldErrors.currentPassword && <p className="mt-1 text-xs text-red-400">{fieldErrors.currentPassword}</p>}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="pw-new">{t("password.new")}</label>
          <input id="pw-new" type="password" className="field" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" required />
          {fieldErrors.newPassword && <p className="mt-1 text-xs text-red-400">{fieldErrors.newPassword}</p>}
        </div>
        <div>
          <label className="label" htmlFor="pw-confirm">{t("password.repeat")}</label>
          <input id="pw-confirm" type="password" className="field" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
          {fieldErrors.confirm && <p className="mt-1 text-xs text-red-400">{fieldErrors.confirm}</p>}
        </div>
      </div>
      <p className="text-xs text-muted">{t("password.hint")}</p>
      <FormError message={error} />
      <Notice text={notice} />
      <button className="btn btn-primary btn-sm" disabled={busy}><KeyRound size={14} /> {busy ? tc("saving") : hasPassword ? t("password.change") : t("password.set")}</button>
    </form>
  );
}

function SessionList({ initial }: { initial: SessionItem[] }) {
  const t = useT("account");
  const f = useFormat();
  const [sessions, setSessions] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  async function run(url: string) {
    setError(null);
    try {
      const res = await api<{ sessions: SessionItem[] }>(url, { method: "DELETE" });
      setSessions(res.sessions);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const others = sessions.filter((s) => !s.current).length;

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {sessions.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center gap-3 rounded-xl border bg-bg/25 px-4 py-3">
            <span className="text-muted">{s.mobile ? <Smartphone size={20} /> : <Monitor size={20} />}</span>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                {s.browser ? (s.os ? t("sessions.device", { browser: s.browser, os: s.os }) : s.browser) : t("sessions.unknownBrowser")}
                {s.current && <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent-ink">{t("sessions.thisDevice")}</span>}
              </p>
              <p className="text-xs text-muted" suppressHydrationWarning>
                {t("sessions.meta", { ip: s.ip ?? t("sessions.unknownIp"), seen: f.ago(s.lastSeenAt), created: f.dateTime(s.createdAt) })}
              </p>
            </div>
            {!s.current && (
              <button className="btn btn-sm" onClick={() => void run(`/api/account/sessions/${s.id}`)}>
                <LogOut size={14} /> {t("sessions.signOut")}
              </button>
            )}
          </li>
        ))}
      </ul>
      <FormError message={error} />
      <button className="btn btn-sm" disabled={others === 0} onClick={() => void run("/api/account/sessions")}>
        <ShieldCheck size={14} /> {t("sessions.signOutOthers")} {others > 0 && `(${others})`}
      </button>
    </div>
  );
}

export function AccountManager({ profile, sessions, children }: { profile: AccountProfile; sessions: SessionItem[]; children?: ReactNode }) {
  const t = useT("account");
  const f = useFormat();
  return (
    <div className="fade-in space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">{t("page.title")}</h1>
        <p className="mt-1 text-muted">
          {t(profile.role === "ADMIN" ? "page.roleAdmin" : "page.roleUser", { date: f.date(profile.createdAt) })}
        </p>
      </header>
      <AccountSection icon={<UserRound size={18} />} title={t("profile.title")}>
        <ProfileForm profile={profile} />
      </AccountSection>
      <AccountSection icon={<KeyRound size={18} />} title={t("password.title")} description={t("password.description")}>
        <PasswordForm hasPassword={profile.hasPassword} />
      </AccountSection>
      {children}
      <AccountSection icon={<Monitor size={18} />} title={t("sessions.title")} description={t("sessions.description")}>
        <SessionList initial={sessions} />
      </AccountSection>
    </div>
  );
}
