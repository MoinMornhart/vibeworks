"use client";

import { History } from "lucide-react";
import { useT } from "@/lib/i18n/client";

/** Hinweis „Entwurf wiederhergestellt · Verwerfen“ unter einem Formular. */
export function DraftNote({ show, onDiscard }: { show: boolean; onDiscard: () => void }) {
  const t = useT("common");
  if (!show) return null;
  return (
    <p className="flex items-center gap-1.5 text-xs text-muted" data-testid="draft-note">
      <History size={12} /> {t("draft.restored")} ·{" "}
      <button type="button" className="text-accent-ink hover:underline" onClick={onDiscard}>
        {t("draft.discard")}
      </button>
    </p>
  );
}
