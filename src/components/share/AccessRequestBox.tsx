"use client";

import { useState } from "react";
import type { ProjectRole } from "@prisma/client";
import { Hourglass, Send } from "lucide-react";
import { FormError } from "@/components/ui/FormError";
import { api, errorMessage } from "@/lib/client/api";
import { useT } from "@/lib/i18n/client";

/** Zugriff auf ein geteiltes Projekt anfragen – für angemeldete Besucher. */
export function AccessRequestBox({ token, initialStatus }: { token: string; initialStatus: "PENDING" | "DENIED" | null }) {
  const t = useT("share");
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
          <p className="font-medium">{t("request.sentTitle")}</p>
          <p className="text-muted">{t("request.sentText")}</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={send} className="space-y-3 rounded-2xl border bg-bg/30 p-4">
      <div>
        <p className="font-medium">{t("request.title")}</p>
        <p className="text-sm text-muted">
          {status === "DENIED" ? t("request.denied") : t("request.ask")}
        </p>
      </div>
      <div role="radiogroup" aria-label={t("request.roleLabel")} className="flex flex-wrap gap-2">
        {(["VIEWER", "EDITOR"] as const).map((r) => (
          <button key={r} type="button" role="radio" aria-checked={role === r} onClick={() => setRole(r)} className={`chip ${role === r ? "chip-active" : ""}`}>
            {t(`role.${r}`)}
          </button>
        ))}
      </div>
      <textarea
        className="field min-h-20 text-sm"
        placeholder={t("request.messagePlaceholder")}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        maxLength={500}
        aria-label={t("request.messageLabel")}
      />
      <FormError message={error} />
      <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
        <Send size={14} /> {busy ? t("request.sending") : t("request.submit")}
      </button>
    </form>
  );
}
