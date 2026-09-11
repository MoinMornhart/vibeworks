"use client";

import { useState } from "react";
import { Eye } from "lucide-react";
import { api, errorMessage } from "@/lib/client/api";
import { FormError } from "@/components/ui/FormError";
import { useT } from "@/lib/i18n/client";

/** Demo-Instanz: ohne Passwort ins gemeinsame Demo-Konto. */
export function DemoLogin({ next }: { next: string }) {
  const t = useT("demo");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/demo", { body: {} });
      window.location.assign(next);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <div data-testid="demo-login" className="mb-6 space-y-3 rounded-xl border border-accent/30 bg-accent/10 p-4">
      <p className="font-semibold">{t("login.title")}</p>
      <p className="text-sm text-muted">{t("login.hint")}</p>
      <button type="button" className="btn btn-primary w-full" onClick={start} disabled={busy}>
        <Eye size={16} /> {busy ? t("login.busy") : t("login.button")}
      </button>
      <FormError message={error} />
    </div>
  );
}
