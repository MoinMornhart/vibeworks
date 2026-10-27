"use client";

import { useEffect, useState } from "react";
import { Globe } from "lucide-react";
import { api, errorMessage } from "@/lib/client/api";
import { confirmDialog } from "@/lib/client/dialogs";
import { toast } from "@/components/ui/Toaster";
import { originOf } from "@/lib/appUrlLogic";
import { useT } from "@/lib/i18n/client";

// Adresse der Instanz im Admin-Dashboard: zeigt, was gilt, und bietet an, die
// Adresse zu übernehmen, über die man gerade hier ist (z. B. nach einem
// Domainwechsel). Eintippen gibt es bewusst nicht – siehe api/admin/address.
export function InstanceAddress({ initial }: { initial: { appUrl: string; envUrl: string } }) {
  const t = useT("admin");
  const [appUrl, setAppUrl] = useState(initial.appUrl);
  const [here, setHere] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fromEnv = appUrl === initial.envUrl;

  // Erst im Browser bekannt – nicht schon beim Rendern auf dem Server
  useEffect(() => setHere(window.location.origin), []);

  async function adopt(origin: string) {
    if (!(await confirmDialog(t("address.confirm", { here: origin }), { title: t("address.confirmTitle"), confirmLabel: t("address.adopt") }))) return;
    setBusy(true);
    try {
      const res = await api<{ appUrl: string }>("/api/admin/address", { method: "POST", body: { action: "adopt" } });
      setAppUrl(res.appUrl);
      toast(t("address.done", { url: res.appUrl }));
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <dd className="space-y-2">
      <div>
        <span className="break-all font-mono" data-testid="instance-address">{appUrl}</span>{" "}
        <span className="text-muted">{fromEnv ? t("instance.addressFromEnv") : t("instance.addressFromAdmin", { env: initial.envUrl })}</span>
      </div>
      {here && here !== (originOf(appUrl) ?? appUrl) && (
        <div className="flex flex-col gap-3 rounded-xl border border-fg/10 bg-bg/20 p-3 sm:flex-row sm:items-center" data-testid="address-adopt">
          <div className="flex min-w-0 flex-1 gap-3">
            <Globe size={18} className="mt-0.5 shrink-0 text-accent-ink" aria-hidden />
            <div className="min-w-0">
              <p className="[overflow-wrap:anywhere]">{t("address.here", { here })}</p>
              <p className="text-xs text-muted">{t("address.hint")}</p>
            </div>
          </div>
          <button type="button" className="btn btn-primary btn-sm self-start sm:self-center" disabled={busy} onClick={() => void adopt(here)}>
            {t("address.adopt")}
          </button>
        </div>
      )}
      {!fromEnv && <p className="text-xs text-muted">{t("address.rescue")}</p>}
    </dd>
  );
}
