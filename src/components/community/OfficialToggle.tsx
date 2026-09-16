"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck } from "lucide-react";
import { api, errorMessage } from "@/lib/client/api";
import { toast } from "@/components/ui/Toaster";
import { useT } from "@/lib/i18n/client";

/** Admins markieren ein Community-Projekt als offiziell (#59). */
export function OfficialToggle({ projectId, official }: { projectId: string; official: boolean }) {
  const t = useT("community");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-sm"
      disabled={busy}
      data-testid="official-toggle"
      onClick={async () => {
        setBusy(true);
        try {
          await api("/api/admin/community/official", { method: "PUT", body: { projectId, official: !official } });
          toast(t(official ? "official.removed" : "official.set"));
          router.refresh();
        } catch (e) {
          toast(errorMessage(e), "error");
        } finally {
          setBusy(false);
        }
      }}
    >
      <BadgeCheck size={14} /> {t(official ? "official.unmark" : "official.mark")}
    </button>
  );
}

export function OfficialBadge() {
  const t = useT("community");
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-sky-400/40 bg-sky-400/10 px-2 py-0.5 text-[11px] font-medium text-sky-300" title={t("official.hint")} data-testid="official-badge">
      <BadgeCheck size={12} /> {t("official.badge")}
    </span>
  );
}
