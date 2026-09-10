"use client";

import { useState } from "react";
import Link from "next/link";
import { UserPlus } from "lucide-react";
import { api, ApiClientError, errorMessage } from "@/lib/client/api";
import { FormError } from "@/components/ui/FormError";

export function RegisterForm() {
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    if (password !== confirm) {
      setFieldErrors({ confirm: "Die Passwörter stimmen nicht überein." });
      return;
    }
    setBusy(true);
    try {
      await api("/api/auth/register", { body: { username, displayName, password } });
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
        <label className="label" htmlFor="username">Benutzername</label>
        <input id="username" className="field" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus />
        {fieldErrors.username && <p className="mt-1 text-xs text-red-400">{fieldErrors.username}</p>}
      </div>
      <div>
        <label className="label" htmlFor="displayName">Anzeigename <span className="opacity-70">(optional)</span></label>
        <input id="displayName" className="field" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="password">Passwort</label>
        <input id="password" type="password" className="field" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {fieldErrors.password && <p className="mt-1 text-xs text-red-400">{fieldErrors.password}</p>}
      </div>
      <div>
        <label className="label" htmlFor="confirm">Passwort wiederholen</label>
        <input id="confirm" type="password" className="field" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        {fieldErrors.confirm && <p className="mt-1 text-xs text-red-400">{fieldErrors.confirm}</p>}
      </div>
      <FormError message={error} />
      <button className="btn btn-primary w-full" disabled={busy}>
        <UserPlus size={16} /> {busy ? "Lege an …" : "Konto anlegen"}
      </button>
      <p className="text-center text-sm text-muted">
        Schon ein Konto? <Link href="/login" className="text-accent-ink hover:underline">Anmelden</Link>
      </p>
    </form>
  );
}
