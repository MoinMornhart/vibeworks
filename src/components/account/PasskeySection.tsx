"use client";

import { useEffect, useState } from "react";
import { browserSupportsWebAuthn, startRegistration } from "@simplewebauthn/browser";
import { Check, Fingerprint, Pencil, Plus, Trash2, X } from "lucide-react";
import { FormError } from "@/components/ui/FormError";
import type { PasskeyItem } from "@/lib/auth/webauthn";
import { api, ApiClientError } from "@/lib/client/api";
import { formatDate, timeAgo } from "@/lib/utils";
import { AccountSection } from "./AccountManager";

function webauthnError(err: unknown): string {
  if (err instanceof ApiClientError) return err.message;
  if (err instanceof Error) {
    if (err.name === "NotAllowedError") return "Abgebrochen oder Zeit abgelaufen.";
    if (err.name === "InvalidStateError") return "Dieser Passkey ist bereits registriert.";
    return err.message;
  }
  return "Unbekannter Fehler";
}

export function PasskeySection({ initial, hasPassword, rpID }: { initial: PasskeyItem[]; hasPassword: boolean; rpID: string }) {
  const [passkeys, setPasskeys] = useState(initial);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSupported(browserSupportsWebAuthn() && window.isSecureContext);
  }, []);

  async function register(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { options } = await api<{ options: Parameters<typeof startRegistration>[0]["optionsJSON"] }>("/api/auth/passkey/register/options", { body: {} });
      const response = await startRegistration({ optionsJSON: options });
      const res = await api<{ passkey: PasskeyItem }>("/api/auth/passkey/register/verify", { body: { response, name: name.trim() || undefined } });
      setPasskeys((list) => [...list, res.passkey]);
      setAdding(false);
      setName("");
    } catch (err) {
      setError(webauthnError(err));
    } finally {
      setBusy(false);
    }
  }

  async function rename(e: React.FormEvent) {
    e.preventDefault();
    if (!renaming) return;
    setError(null);
    try {
      const res = await api<{ passkey: PasskeyItem }>(`/api/account/passkeys/${renaming.id}`, { method: "PATCH", body: { name: renaming.name } });
      setPasskeys((list) => list.map((p) => (p.id === res.passkey.id ? res.passkey : p)));
      setRenaming(null);
    } catch (err) {
      setError(webauthnError(err));
    }
  }

  async function remove(p: PasskeyItem) {
    if (!window.confirm(`Passkey „${p.name ?? "Passkey"}“ entfernen? Auf dem Gerät bleibt er gespeichert, funktioniert hier aber nicht mehr.`)) return;
    setError(null);
    try {
      await api(`/api/account/passkeys/${p.id}`, { method: "DELETE" });
      setPasskeys((list) => list.filter((x) => x.id !== p.id));
    } catch (err) {
      setError(webauthnError(err));
    }
  }

  return (
    <AccountSection
      icon={<Fingerprint size={18} />}
      title="Passkeys"
      description="Anmelden per Fingerabdruck, Gesichtserkennung oder Sicherheitsschlüssel – ohne Passwort und ohne Benutzernamen."
    >
      <div className="space-y-4">
        {passkeys.length > 0 ? (
          <ul className="space-y-2">
            {passkeys.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 rounded-xl border bg-bg/25 px-4 py-3">
                <Fingerprint size={20} className="text-muted" />
                {renaming?.id === p.id ? (
                  <form onSubmit={rename} className="flex min-w-0 flex-1 gap-2">
                    <input className="field !min-h-8 !py-1" value={renaming.name} onChange={(e) => setRenaming({ id: p.id, name: e.target.value })} maxLength={60} autoFocus aria-label="Neuer Name" />
                    <button className="btn btn-sm btn-icon" aria-label="Speichern"><Check size={15} /></button>
                    <button type="button" className="btn btn-sm btn-icon" onClick={() => setRenaming(null)} aria-label="Abbrechen"><X size={15} /></button>
                  </form>
                ) : (
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{p.name ?? "Passkey"}</p>
                    <p className="text-xs text-muted" suppressHydrationWarning>
                      angelegt {formatDate(p.createdAt)} · {p.lastUsedAt ? `zuletzt benutzt ${timeAgo(p.lastUsedAt)}` : "noch nie benutzt"}
                    </p>
                  </div>
                )}
                {renaming?.id !== p.id && (
                  <div className="flex gap-1">
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setRenaming({ id: p.id, name: p.name ?? "" })} aria-label="Umbenennen"><Pencil size={14} /></button>
                    <button className="btn btn-ghost btn-icon btn-sm hover:!text-red-400" onClick={() => void remove(p)} aria-label="Entfernen"><Trash2 size={14} /></button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Noch keine Passkeys.</p>
        )}

        {supported === false ? (
          <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
            Passkeys brauchen eine sichere Verbindung – HTTPS oder localhost. Über eine IP-Adresse ohne Zertifikat stellt der Browser sie nicht bereit.
          </p>
        ) : adding ? (
          <form onSubmit={register} className="flex flex-wrap items-center gap-2">
            <input className="field max-w-xs" placeholder="Name, z. B. „Handy“ (optional)" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoFocus aria-label="Name des Passkeys" />
            <button className="btn btn-primary btn-sm" disabled={busy}><Fingerprint size={14} /> {busy ? "Warte auf Gerät …" : "Jetzt registrieren"}</button>
            <button type="button" className="btn btn-sm" onClick={() => setAdding(false)}>Abbrechen</button>
          </form>
        ) : (
          <button className="btn btn-sm" onClick={() => { setAdding(true); setError(null); }} disabled={supported === null}>
            <Plus size={14} /> Passkey hinzufügen
          </button>
        )}
        <FormError message={error} />
        <p className="text-xs text-muted">
          Passkeys gelten für <strong>{rpID}</strong>. Ändert sich die Adresse der Instanz, müssen sie neu angelegt werden.
          {!hasPassword && " Dein Konto hat kein Passwort – der letzte Passkey lässt sich deshalb nicht entfernen."}
        </p>
      </div>
    </AccountSection>
  );
}
