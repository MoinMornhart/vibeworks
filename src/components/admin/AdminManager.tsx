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
import { cn, formatDate, timeAgo } from "@/lib/utils";

interface Settings {
  mode: "SINGLE" | "MULTI";
  allowRegistration: boolean;
  taskColumnLimit: number;
}

function SettingsForm({ initial, userCount }: { initial: Settings; userCount: number }) {
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
      setNotice("Einstellungen gespeichert.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <span className="label">Betriebsart</span>
        <Segmented
          label="Betriebsart"
          value={s.mode}
          onChange={(mode) => setS({ ...s, mode })}
          options={[
            { value: "SINGLE", label: "Einzelbetrieb", icon: <User size={14} /> },
            { value: "MULTI", label: "Mehrbenutzer", icon: <Users size={14} /> },
          ]}
        />
        <p className="mt-1.5 text-xs text-muted">
          {s.mode === "SINGLE"
            ? userCount > 1
              ? `Es gibt ${userCount} Konten – für den Einzelbetrieb müssen alle bis auf eines gelöscht werden.`
              : "Genau ein Konto, keine Registrierung, keine Benutzerliste."
            : "Beliebig viele Konten mit strikt getrennten Daten."}
        </p>
      </div>
      {s.mode === "MULTI" && (
        <div className="max-w-md">
          <Toggle
            label="Selbstregistrierung erlauben"
            hint="Jeder, der die Adresse kennt, kann sich ein Konto anlegen"
            checked={s.allowRegistration}
            onChange={(allowRegistration) => setS({ ...s, allowRegistration })}
          />
        </div>
      )}
      <div className="max-w-xs">
        <label className="label" htmlFor="col-limit">Karten je Spalte im Aufgabenbrett</label>
        <input
          id="col-limit"
          type="number"
          min={0}
          max={500}
          className="field"
          value={s.taskColumnLimit}
          onChange={(e) => setS({ ...s, taskColumnLimit: Math.max(0, Number(e.target.value) || 0) })}
        />
        <p className="mt-1 text-xs text-muted">Was darüber hinausgeht, steht hinter „n weitere anzeigen“. 0 = keine Begrenzung.</p>
      </div>
      <FormError message={error} />
      {notice && <p role="status" className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">{notice}</p>}
      <button className="btn btn-primary btn-sm" onClick={save} disabled={busy || !dirty}>
        <Save size={14} /> {busy ? "Speichere …" : "Einstellungen speichern"}
      </button>
    </div>
  );
}

function CreateUserForm({ onCreated }: { onCreated: (users: AdminUser[]) => void }) {
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
      <p className="flex items-center gap-2 text-sm font-medium"><UserPlus size={15} /> Konto anlegen</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <input className="field" placeholder="Benutzername" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required aria-label="Benutzername" autoComplete="off" />
          {fieldErrors.username && <p className="mt-1 text-xs text-red-400">{fieldErrors.username}</p>}
        </div>
        <input className="field" placeholder="Anzeigename (optional)" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} aria-label="Anzeigename" />
        <div>
          <input type="password" className="field" placeholder="Startpasswort" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required aria-label="Startpasswort" autoComplete="new-password" />
          {fieldErrors.password && <p className="mt-1 text-xs text-red-400">{fieldErrors.password}</p>}
        </div>
        <select className="field" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as "USER" | "ADMIN" })} aria-label="Rolle">
          <option value="USER">Benutzer</option>
          <option value="ADMIN">Administrator</option>
        </select>
      </div>
      <FormError message={error} />
      <button className="btn btn-sm" disabled={busy}><UserPlus size={14} /> {busy ? "Lege an …" : "Anlegen"}</button>
    </form>
  );
}

function UserRow({ user: u, isMe, onChange }: { user: AdminUser; isMe: boolean; onChange: (users: AdminUser[]) => void }) {
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
    if (!window.confirm(`Konto „${u.username}“ mit allen ${u.projects} Projekten, Notizen und Aufgaben endgültig löschen?`)) return;
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
            {u.role === "ADMIN" && <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] text-accent-ink">Admin</span>}
            {isMe && <span className="rounded-full bg-fg/10 px-2 py-0.5 text-[11px] text-muted">Du</span>}
            {!u.active && <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] text-red-400">Deaktiviert</span>}
            {u.locked && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] text-amber-400">Gesperrt</span>}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-muted" suppressHydrationWarning>
            <span>{u.projects} Projekt{u.projects === 1 ? "" : "e"}</span>
            {u.passkeys > 0 && <span className="inline-flex items-center gap-1"><Fingerprint size={11} /> {u.passkeys}</span>}
            {u.twoFactor && <span className="inline-flex items-center gap-1"><ShieldCheck size={11} /> 2FA</span>}
            <span>{u.lastLoginAt ? `zuletzt angemeldet ${timeAgo(u.lastLoginAt)}` : "noch nie angemeldet"}</span>
            <span>seit {formatDate(u.createdAt)}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {u.locked && (
            <button className="btn btn-sm" onClick={() => void patch({ unlock: true })} disabled={busy} title="Sperre aufheben"><LockOpen size={14} /></button>
          )}
          <select
            className="field !min-h-8 !w-auto !py-1 text-xs"
            value={u.role}
            onChange={(e) => void patch({ role: e.target.value })}
            disabled={busy}
            aria-label={`Rolle von ${u.username}`}
          >
            <option value="USER">Benutzer</option>
            <option value="ADMIN">Administrator</option>
          </select>
          <button className="btn btn-sm" onClick={() => setPwOpen(true)} disabled={busy} title="Passwort neu setzen"><KeyRound size={14} /></button>
          {!isMe && (
            <>
              <button className="btn btn-sm" onClick={() => void patch({ active: !u.active })} disabled={busy} title={u.active ? "Deaktivieren" : "Aktivieren"}>
                {u.active ? <Ban size={14} /> : <UserCheck size={14} />}
              </button>
              <button className="btn btn-danger btn-sm" onClick={remove} disabled={busy} title="Löschen"><Trash2 size={14} /></button>
            </>
          )}
        </div>
      </div>
      {error && <div className="mt-2"><FormError message={error} /></div>}
      <Modal
        open={pwOpen}
        onClose={() => setPwOpen(false)}
        title={`Neues Passwort für ${u.username}`}
        size="sm"
        footer={
          <>
            <button className="btn btn-sm" onClick={() => setPwOpen(false)}>Abbrechen</button>
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
              <KeyRound size={14} /> Setzen
            </button>
          </>
        }
      >
        <p className="mb-3 text-sm text-muted">Alle Sitzungen des Kontos werden sofort beendet.</p>
        <input type="password" className="field" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Neues Passwort" autoComplete="new-password" aria-label="Neues Passwort" autoFocus />
        {error && <div className="mt-3"><FormError message={error} /></div>}
      </Modal>
    </li>
  );
}

export function AdminManager({
  meId,
  initialSettings,
  initialUsers,
  version,
  appUrl,
}: {
  meId: string;
  initialSettings: Settings;
  initialUsers: AdminUser[];
  version: string;
  appUrl: string;
}) {
  const [users, setUsers] = useState(initialUsers);

  return (
    <div className="fade-in space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Administration</h1>
        <p className="mt-1 text-muted">Konten und Einstellungen der Instanz. Fremde Projekte sind auch hier nicht einsehbar.</p>
      </header>

      <AccountSection icon={<Settings2 size={18} />} title="Einstellungen">
        <SettingsForm initial={initialSettings} userCount={users.length} />
      </AccountSection>

      <AccountSection icon={<Users size={18} />} title="Konten" description={`${users.length} ${users.length === 1 ? "Konto" : "Konten"}`}>
        <div className="space-y-4">
          <ul className="space-y-2">
            {users.map((u) => (
              <UserRow key={u.id} user={u} isMe={u.id === meId} onChange={setUsers} />
            ))}
          </ul>
          {initialSettings.mode === "MULTI" || users.length > 1 ? (
            <CreateUserForm onCreated={setUsers} />
          ) : (
            <p className="text-xs text-muted">Weitere Konten gibt es im Mehrbenutzerbetrieb.</p>
          )}
        </div>
      </AccountSection>

      <AccountSection icon={<Server size={18} />} title="Instanz">
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
          <dt className="text-muted">Version</dt>
          <dd className="font-mono">{version}</dd>
          <dt className="text-muted">Adresse (APP_URL)</dt>
          <dd className="break-all font-mono">{appUrl}</dd>
          <dt className="text-muted">Aktualisieren</dt>
          <dd>Auf dem Server <code className="rounded bg-fg/10 px-1.5 py-0.5 font-mono text-xs">update</code> ausführen – das Auto-Update prüft ohnehin alle 15 Minuten.</dd>
        </dl>
      </AccountSection>
    </div>
  );
}
