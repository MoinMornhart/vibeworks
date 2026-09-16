"use client";

import { useState } from "react";
import { FlaskConical, X } from "lucide-react";
import { api, errorMessage } from "@/lib/client/api";
import { toast } from "@/components/ui/Toaster";
import { useT } from "@/lib/i18n/client";

/** Roter Balken der Beta-Ansicht (#68) – das Kreuz beendet sie. */
export function BetaBanner() {
  const t = useT("admin");
  const [busy, setBusy] = useState(false);
  return (
    <div role="note" data-testid="beta-banner" className="sticky top-0 z-40 flex items-center justify-center gap-2 border-b border-red-500/50 bg-red-600/90 px-4 py-2 text-sm text-white">
      <FlaskConical size={15} aria-hidden />
      <span>{t("beta.banner")}</span>
      <button
        type="button"
        className="ml-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/15 hover:bg-white/30"
        aria-label={t("beta.exit")}
        title={t("beta.exit")}
        disabled={busy}
        data-testid="beta-exit"
        onClick={async () => {
          setBusy(true);
          try {
            await api("/api/admin/beta", { body: { on: false } });
            window.location.reload();
          } catch (e) {
            toast(errorMessage(e), "error");
            setBusy(false);
          }
        }}
      >
        <X size={16} strokeWidth={3} />
      </button>
    </div>
  );
}

/** Knopf in der Administration: Beta-Ansicht starten. */
export function BetaStartButton() {
  const t = useT("admin");
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-sm"
      disabled={busy}
      data-testid="beta-start"
      onClick={async () => {
        setBusy(true);
        try {
          await api("/api/admin/beta", { body: { on: true } });
          window.location.reload();
        } catch (e) {
          toast(errorMessage(e), "error");
          setBusy(false);
        }
      }}
    >
      <FlaskConical size={14} /> {t("beta.start")}
    </button>
  );
}
