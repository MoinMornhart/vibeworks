"use client";

import { useState } from "react";
import Link from "next/link";
import { LogIn } from "lucide-react";
import { api, errorMessage } from "@/lib/client/api";
import { FormError } from "@/components/ui/FormError";

export function LoginForm({ next, allowRegistration }: { next: string; allowRegistration: boolean }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/login", { body: { username, password } });
      // Volles Neuladen, damit das persönliche Design des Kontos greift.
      window.location.assign(next);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label" htmlFor="username">Benutzername</label>
        <input id="username" className="field" autoComplete="username" autoFocus value={username} onChange={(e) => setUsername(e.target.value)} required />
      </div>
      <div>
        <label className="label" htmlFor="password">Passwort</label>
        <input id="password" type="password" className="field" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>
      <FormError message={error} />
      <button className="btn btn-primary w-full" disabled={busy}>
        <LogIn size={16} /> {busy ? "Anmelden …" : "Anmelden"}
      </button>
      {allowRegistration && (
        <p className="text-center text-sm text-muted">
          Noch kein Konto? <Link href="/register" className="text-accent-ink hover:underline">Registrieren</Link>
        </p>
      )}
    </form>
  );
}
