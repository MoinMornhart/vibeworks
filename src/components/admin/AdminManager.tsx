"use client";

import { useState } from "react";
import {
  Ban,
  Fingerprint,
  KeyRound,
  LockOpen,
  Save,
  Server,
  Settings2,
  ShieldCheck,
  Trash2,
  User,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { FormError } from "@/components/ui/FormError";
import { Segmented, Toggle } from "@/components/theme/controls";
import { AccountSection } from "@/components/account/AccountManager";
import type { AdminUser } from "@/lib/admin";
import { api, ApiClientError, errorMessage } from "@/lib/client/api";
import { cn } from "@/lib/utils";
import { useFormat, useT } from "@/lib/i18n/client";
import type { PublicBuildInfo } from "@/lib/buildInfo";
import { CloudDownload } from "lucide-react";
import { UpdatePanel } from "./UpdatePanel";

interface Settings {
  mode: "SINGLE" | "MULTI";
  allowRegistration: boolean;
  taskColumnLimit: number;
}

function SettingsForm({ initial, userCount }: { initial: Settings; userCount: number }) {
  const t = useT("admin");
  const tc = useT("common");
  const [s, setS] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const dirty = JSON.stringify(s) !== JSON.stringify(saved);

  async function save() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await api<{ settings: Settings }>("/api/admin/settings", { method: "PATCH", body: s });
      setS(res.settings);
      setSaved(res.settings);
      setNotice(t("settings.saved"));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <span className="label">{t("settings.mode")}</span>
        <Segmented
          label={t("settings.mode")}
          value={s.mode}
          onChange={(mode) => setS({ ...s, mode })}
          options={[
            { value: "SINGLE", label: t("settings.single"), icon: <User size={14} /> },
            { value: "MULTI", label: t("settings.multi"), icon: <Users size={14} /> },
          ]}
        />
        <p className="mt-1.5 text-xs text-muted">
          {s.mode === "SINGLE"
            ? userCount > 1
              ? t("settings.singleTooMany", { n: userCount })
              : t("settings.singleHint")
            : t("settings.multiHint")}
        </p>
      </div>
      {s.mode === "MULTI" && (
        <div className="max-w-md">
          <Toggle
            label={t("settings.allowRegistration")}
            hint={t("settings.allowRegistrationHint")}
            checked={s.allowRegistration}
            onChange={(allowRegistration) => setS({ ...s, allowRegistration })}
          />
        </div>
      )}
      <div className="max-w-xs">
        <label className="label" htmlFor="col-limit">{t("settings.columnLimit")}</label>
        <input
          id="col-limit"
          type="number"
          min={0}
          max={500}
          className="field"
          value={s.taskColumnLimit}
          onChange={(e) => setS({ ...s, taskColumnLimit: Math.max(0, Number(e.target.value) || 0) })}
        />
        <p className="mt-1 text-xs text-muted">{t("settings.columnLimitHint")}</p>
      </div>
      <FormError message={error} />
      {notice && <p role="status" className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">{notice}</p>}
      <button className="btn btn-primary btn-sm" onClick={save} disabled={busy || !dirty}>
        <Save size={14} /> {busy ? tc("saving") : t("settings.save")}
      </button>
    </div>
  );
}

function CreateUserForm({ onCreated }: { onCreated: (users: AdminUser[]) => void }) {
  const t = useT("admin");
  const tc = useT("common");
  const [form, setForm] = useState({ username: "", displayName: "", password: "", role: "USER" as "USER" | "ADMIN" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      const res = await api<{ users: AdminUser[] }>("/api/admin/users", { body: form });
      onCreated(res.users);
      setForm({ username: "", displayName: "", password: "", role: "USER" });
    } catch (err) {
      if (err instanceof ApiClientError) setFieldErrors(err.fieldErrors);
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-dashed p-4">
      <p className="flex items-center gap-2 text-sm font-medium"><UserPlus size={15} /> {t("create.title")}</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <input className="field" placeholder={t("create.username")} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required aria-label={t("create.username")} autoComplete="off" />
          {fieldErrors.username && <p className="mt-1 text-xs text-red-400">{fieldErrors.username}</p>}
        </div>
        <input className="field" placeholder={t("create.displayNamePlaceholder")} value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} aria-label={t("create.displayName")} />
        <div>
          <input type="password" className="field" placeholder={t("create.password")} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required aria-label={t("create.password")} autoComplete="new-password" />
          {fieldErrors.password && <p className="mt-1 text-xs text-red-400">{fieldErrors.password}</p>}
        </div>
        <select className="field" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as "USER" | "ADMIN" })} aria-label={t("create.role")}>
          <option value="USER">{t("roles.USER")}</option>
          <option value="ADMIN">{t("roles.ADMIN")}</option>
        </select>
      </div>
      <FormError message={error} />
      <button className="btn btn-sm" disabled={busy}><UserPlus size={14} /> {busy ? t("create.creating") : tc("create")}</button>
    </form>
  );
}

function UserRow({ user: u, isMe, onChange }: { user: AdminUser; isMe: boolean; onChange: (users: AdminUser[]) => void }) {
  const t = useT("admin");
  const tc = useT("common");
  const f = useFormat();
  const [pwOpen, setPwOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function patch(body: object) {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ users: AdminUser[] }>(`/api/admin/users/${u.id}`, { method: "PATCH", body });
      onChange(res.users);
      return true;
    } catch (err) {
      setError(errorMessage(err));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(t("users.confirmDelete", { name: u.username, n: u.projects }))) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ users: AdminUser[] }>(`/api/admin/users/${u.id}`, { method: "DELETE" });
      onChange(res.users);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className={cn("rounded-xl border bg-bg/25 px-4 py-3", !u.active && "opacity-60")}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-sm font-bold text-accent-ink">
          {(u.displayName || u.username).slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
            {u.displayName || u.username}
            <span className="font-normal text-muted">@{u.username}</span>
            {u.role === "ADMIN" && <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] text-accent-ink">{t("users.admin")}</span>}
            {isMe && <span className="rounded-full bg-fg/10 px-2 py-0.5 text-[11px] text-muted">{t("users.you")}</span>}
            {!u.active && <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] text-red-400">{t("users.disabled")}</span>}
            {u.locked && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] text-amber-400">{t("users.locked")}</span>}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-muted" suppressHydrationWarning>
            <span>{t("users.projects", { n: u.projects })}</span>
            {u.passkeys > 0 && <span className="inline-flex items-center gap-1"><Fingerprint size={11} /> {u.passkeys}</span>}
            {u.twoFactor && <span className="inline-flex items-center gap-1"><ShieldCheck size={11} /> 2FA</span>}
            <span>{u.lastLoginAt ? t("users.lastLogin", { ago: f.ago(u.lastLoginAt) }) : t("users.neverLoggedIn")}</span>
            <span>{t("users.since", { date: f.date(u.createdAt) })}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {u.locked && (
            <button className="btn btn-sm" onClick={() => void patch({ unlock: true })} disabled={busy} title={t("users.unlock")}><LockOpen size={14} /></button>
          )}
          <select
            className="field !min-h-8 !w-auto !py-1 text-xs"
            value={u.role}
            onChange={(e) => void patch({ role: e.target.value })}
            disabled={busy}
            aria-label={t("users.roleOf", { name: u.username })}
          >
            <option value="USER">{t("roles.USER")}</option>
            <option value="ADMIN">{t("roles.ADMIN")}</option>
          </select>
          <button className="btn btn-sm" onClick={() => setPwOpen(true)} disabled={busy} title={t("users.resetPassword")}><KeyRound size={14} /></button>
          {!isMe && (
            <>
              <button className="btn btn-sm" onClick={() => void patch({ active: !u.active })} disabled={busy} title={u.active ? t("users.deactivate") : t("users.activate")}>
                {u.active ? <Ban size={14} /> : <UserCheck size={14} />}
              </button>
              <button className="btn btn-danger btn-sm" onClick={remove} disabled={busy} title={tc("delete")}><Trash2 size={14} /></button>
            </>
          )}
        </div>
      </div>
      {error && <div className="mt-2"><FormError message={error} /></div>}
      <Modal
        open={pwOpen}
        onClose={() => setPwOpen(false)}
        title={t("users.newPasswordFor", { name: u.username })}
        size="sm"
        footer={
          <>
            <button className="btn btn-sm" onClick={() => setPwOpen(false)}>{tc("cancel")}</button>
            <button
              className="btn btn-primary btn-sm"
              disabled={busy || !password}
              onClick={async () => {
                if (await patch({ password })) {
                  setPwOpen(false);
                  setPassword("");
                }
              }}
            >
              <KeyRound size={14} /> {t("users.setPassword")}
            </button>
          </>
        }
      >
        <p className="mb-3 text-sm text-muted">{t("users.sessionsEnd")}</p>
        <input type="password" className="field" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("users.newPassword")} autoComplete="new-password" aria-label={t("users.newPassword")} autoFocus />
        {error && <div className="mt-3"><FormError message={error} /></div>}
      </Modal>
    </li>
  );
}

export function AdminManager({
  meId,
  initialSettings,
  initialUsers,
  build,
  appUrl,
  update,
}: {
  meId: string;
  initialSettings: Settings;
  initialUsers: AdminUser[];
  build: PublicBuildInfo & { builtAt: string | null; source: string };
  appUrl: string;
  update: Parameters<typeof UpdatePanel>[0]["initial"];
}) {
  const t = useT("admin");
  const f = useFormat();
  const [users, setUsers] = useState(initialUsers);
  const source = build.source === "env" ? t("instance.sourceEnv") : build.source === "git" ? t("instance.sourceGit") : "package.json";

  return (
    <div className="fade-in space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">{t("page.title")}</h1>
        <p className="mt-1 text-muted">{t("page.intro")}</p>
      </header>

      <AccountSection icon={<Settings2 size={18} />} title={t("settings.title")}>
        <SettingsForm initial={initialSettings} userCount={users.length} />
      </AccountSection>

      <AccountSection icon={<Users size={18} />} title={t("users.title")} description={t("users.count", { n: users.length })}>
        <div className="space-y-4">
          <ul className="space-y-2">
            {users.map((u) => (
              <UserRow key={u.id} user={u} isMe={u.id === meId} onChange={setUsers} />
            ))}
          </ul>
          {initialSettings.mode === "MULTI" || users.length > 1 ? (
            <CreateUserForm onCreated={setUsers} />
          ) : (
            <p className="text-xs text-muted">{t("users.moreInMulti")}</p>
          )}
        </div>
      </AccountSection>

      <AccountSection icon={<Server size={18} />} title={t("instance.title")}>
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
          <dt className="text-muted">{t("instance.version")}</dt>
          <dd>
            <span className="font-mono">{build.version}</span>
            {build.count !== null && <span className="text-muted"> · {t("instance.updateNo", { n: build.count })}</span>}
          </dd>
          <dt className="text-muted">{t("instance.commit")}</dt>
          <dd className="font-mono">
            {build.shortCommit ? (
              build.commitUrl ? (
                <a href={build.commitUrl} target="_blank" rel="noopener noreferrer" className="text-accent-ink hover:underline">{build.shortCommit}</a>
              ) : (
                build.shortCommit
              )
            ) : (
              t("instance.unknown")
            )}
            {build.dirty && <span className="font-sans text-muted"> {t("instance.dirty")}</span>}
            {build.commitDate && <span className="font-sans text-muted"> · {f.dateTime(build.commitDate)}</span>}
          </dd>
          <dt className="text-muted">{t("instance.built")}</dt>
          <dd>{build.builtAt ? f.dateTime(build.builtAt) : "–"} <span className="text-muted">{t("instance.source", { source })}</span></dd>
          <dt className="text-muted">{t("instance.address")}</dt>
          <dd className="break-all font-mono">{appUrl}</dd>
        </dl>
      </AccountSection>

      <AccountSection icon={<CloudDownload size={18} />} title={t("update.title")} description={t("update.description")}>
        <UpdatePanel initial={update} />
      </AccountSection>
    </div>
  );
}
