"use client";

import { useEffect, useState } from "react";
import { Bot, Check, Copy, Download } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { FormError } from "@/components/ui/FormError";
import { api, errorMessage } from "@/lib/client/api";
import { useT } from "@/lib/i18n/client";

/** CLAUDE.md eines Projekts: erzeugen, anpassen, kopieren oder herunterladen. */
export function ClaudeMdDialog({ projectId, name, open, onClose }: { projectId: string; name: string; open: boolean; onClose: () => void }) {
  const t = useT("prompts");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    setCopied(false);
    api<{ markdown: string }>(`/api/projects/${projectId}/claude-md`)
      .then((r) => setText(r.markdown))
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setLoading(false));
  }, [open, projectId]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* Zwischenablage gesperrt – der Text steht ja da */
    }
  }

  function download() {
    const url = URL.createObjectURL(new Blob([text], { type: "text/markdown;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "CLAUDE.md";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <Modal open={open} onClose={onClose} size="xl" title={<span className="flex items-center gap-2"><Bot size={18} className="text-accent-ink" /> {t("claudeMd.title", { name })}</span>}>
      <div className="space-y-3">
        <p className="text-sm text-muted">{t("claudeMd.hint")}</p>
        <textarea
          className="field min-h-[50dvh] font-mono text-xs leading-relaxed"
          value={loading ? t("claudeMd.loading") : text}
          onChange={(e) => setText(e.target.value)}
          readOnly={loading}
          spellCheck={false}
          aria-label="CLAUDE.md"
          data-testid="claude-md"
        />
        <FormError message={error} />
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="btn btn-sm" disabled={loading || !text} onClick={download}><Download size={14} /> {t("claudeMd.download")}</button>
          <button type="button" className="btn btn-primary btn-sm" disabled={loading || !text} onClick={() => void copy()}>
            {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? t("claudeMd.copied") : t("claudeMd.copy")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
