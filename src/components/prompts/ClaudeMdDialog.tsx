"use client";

import { useEffect, useState } from "react";
import { Bot, Check, Copy, Download } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { FormError } from "@/components/ui/FormError";
import { api, errorMessage } from "@/lib/client/api";
import { AGENT_FILES, AGENT_TARGETS, type AgentTarget } from "@/lib/agentFileLogic";
import { useT } from "@/lib/i18n/client";

/** KI-Anleitung eines Projekts (CLAUDE.md, AGENTS.md, … #107): erzeugen, anpassen, kopieren oder herunterladen. */
export function ClaudeMdDialog({ projectId, name, open, onClose }: { projectId: string; name: string; open: boolean; onClose: () => void }) {
  const t = useT("prompts");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [target, setTarget] = useState<AgentTarget>("claude");
  const [path, setPath] = useState("CLAUDE.md");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    setCopied(false);
    api<{ markdown: string; path: string }>(`/api/projects/${projectId}/claude-md?target=${target}`)
      .then((r) => {
        setText(r.markdown);
        setPath(r.path);
      })
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setLoading(false));
  }, [open, projectId, target]);

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
    a.download = path.split("/").pop() ?? "CLAUDE.md";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <Modal open={open} onClose={onClose} size="xl" title={<span className="flex items-center gap-2"><Bot size={18} className="text-accent-ink" /> {t("claudeMd.title", { name })}</span>}>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label={t("claudeMd.for")} data-testid="agent-targets">
          {AGENT_TARGETS.map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={target === k}
              className={target === k ? "chip chip-active !py-0.5 text-xs" : "chip !py-0.5 text-xs"}
              title={AGENT_FILES[k].tools}
              onClick={() => setTarget(k)}
            >
              {AGENT_FILES[k].path.split("/").pop()}
            </button>
          ))}
        </div>
        <p className="text-sm text-muted" data-testid="agent-file-hint">
          {t("claudeMd.hintFor", { path, tools: AGENT_FILES[target].tools })}
        </p>
        <textarea
          className="field min-h-[50dvh] font-mono text-xs leading-relaxed"
          value={loading ? t("claudeMd.loading") : text}
          onChange={(e) => setText(e.target.value)}
          readOnly={loading}
          spellCheck={false}
          aria-label={path}
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
