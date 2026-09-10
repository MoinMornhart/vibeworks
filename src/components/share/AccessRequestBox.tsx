"use client";

import { useState } from "react";
import type { ProjectRole } from "@prisma/client";
import { Hourglass, Send } from "lucide-react";
import { FormError } from "@/components/ui/FormError";
import { api, errorMessage } from "@/lib/client/api";

/** Zugriff auf ein geteiltes Projekt anfragen – für angemeldete Besucher. */
export function AccessRequestBox({ token, initialStatus }: { token: string; initialStatus: "PENDING" | "DENIED" | null }) {
  const [status, setStatus] = useState(initialStatus);
  const [role, setRole] = useState<ProjectRole>("VIEWER");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(`/api/share/${token}/request`, { body: { role, message } });
      setStatus("PENDING");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (status === "PENDING") {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-accent/40 bg-accent/10 p-4 text-sm">
        <Hourglass size={18} className="mt-0.5 shrink-0 text-accent-ink" />
        <div>
          <p className="font-medium">Anfrage gesendet</p>
          <p className="text-muted">Sobald der Besitzer zustimmt, erscheint das Projekt auf deinem Dashboard unter „Mit mir geteilt“.</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={send} className="space-y-3 rounded-2xl border bg-bg/30 p-4">
      <div>
        <p className="font-medium">Mitarbeiten?</p>
        <p className="text-sm text-muted">
          {status === "DENIED" ? "Deine letzte Anfrage wurde abgelehnt – du kannst es erneut versuchen." : "Frag den Besitzer nach Zugriff auf dieses Projekt."}
        </p>
      </div>
      <div role="radiogroup" aria-label="Gewünschte Rolle" className="flex flex-wrap gap-2">
        {(["VIEWER", "EDITOR"] as const).map((r) => (
          <button key={r} type="button" role="radio" aria-checked={role === r} onClick={() => setRole(r)} className={`chip ${role === r ? "chip-active" : ""}`}>
            {r === "VIEWER" ? "Ansehen" : "Bearbeiten"}
          </button>
        ))}
      </div>
      <textarea
        className="field min-h-20 text-sm"
        placeholder="Nachricht an den Besitzer (optional)"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        maxLength={500}
        aria-label="Nachricht an den Besitzer"
      />
      <FormError message={error} />
      <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
        <Send size={14} /> {busy ? "Sende …" : "Zugriff anfragen"}
      </button>
    </form>
  );
}
