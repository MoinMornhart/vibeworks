"use client";

import { useEffect, useRef, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { Modal } from "./Modal";
import { DIALOG_EVENT, markDialogHost, type DialogRequest } from "@/lib/client/dialogs";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

/** Zeigt Rückfragen aus confirmDialog/promptDialog – eine nach der anderen (#109). */
export function DialogHost() {
  const t = useT("common");
  const [queue, setQueue] = useState<DialogRequest[]>([]);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const current = queue[0] ?? null;

  useEffect(() => {
    const on = (e: Event) => setQueue((q) => [...q, (e as CustomEvent<DialogRequest>).detail]);
    window.addEventListener(DIALOG_EVENT, on);
    markDialogHost(true);
    return () => {
      window.removeEventListener(DIALOG_EVENT, on);
      markDialogHost(false);
    };
  }, []);

  useEffect(() => {
    if (current?.kind === "prompt") setValue(current.options.defaultValue ?? "");
  }, [current]);

  function finish(ok: boolean) {
    if (!current) return;
    if (current.kind === "confirm") current.resolve(ok);
    else if (current.kind === "choice") current.resolve(null);
    else current.resolve(ok ? value : null);
    setQueue((q) => q.slice(1));
  }

  function choose(key: string) {
    if (current?.kind !== "choice") return;
    current.resolve(key);
    setQueue((q) => q.slice(1));
  }

  if (!current) return null;
  const danger = current.kind === "confirm" && current.options.danger;
  const TONE = { primary: "btn-primary", danger: "!border-red-500/60 !bg-red-500/20 !text-red-400 hover:!bg-red-500/30", plain: "btn-ghost" } as const;
  return (
    <Modal
      open
      size="sm"
      onClose={() => finish(false)}
      title={
        <span className="flex items-center gap-2">
          {danger && <TriangleAlert size={18} className="text-red-400" />}
          {current.options.title ?? (current.kind === "prompt" ? t("dialog.promptTitle") : t("dialog.confirmTitle"))}
        </span>
      }
      footer={
        current.kind === "choice" ? (
          <>
            {current.options.choices.map((c, i) => (
              <button key={c.key} type="button" className={cn("btn btn-sm", TONE[c.tone ?? "plain"])} onClick={() => choose(c.key)} data-testid={`dialog-choice-${c.key}`} autoFocus={i === 0}>
                {c.label}
              </button>
            ))}
          </>
        ) : (
        <>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => finish(false)} data-testid="dialog-cancel">
            {t("cancel")}
          </button>
          <button
            type="submit"
            form="vw-dialog-form"
            className={cn("btn btn-sm", danger ? "!border-red-500/60 !bg-red-500/20 !text-red-400 hover:!bg-red-500/30" : "btn-primary")}
            data-testid="dialog-confirm"
            autoFocus={current.kind === "confirm"}
          >
            {current.options.confirmLabel ?? t("dialog.confirm")}
          </button>
        </>
        )
      }
    >
      <form
        id="vw-dialog-form"
        data-testid="dialog"
        onSubmit={(e) => {
          e.preventDefault();
          finish(true);
        }}
        className="space-y-3"
      >
        <p className="whitespace-pre-line text-sm">{current.message}</p>
        {current.kind === "prompt" &&
          (current.options.multiline ? (
            <textarea
              ref={inputRef}
              autoFocus
              className="field min-h-24"
              value={value}
              placeholder={current.options.placeholder}
              maxLength={current.options.maxLength}
              onChange={(e) => setValue(e.target.value)}
              aria-label={current.message}
              data-testid="dialog-input"
            />
          ) : (
            <input
              ref={inputRef}
              autoFocus
              className="field"
              value={value}
              placeholder={current.options.placeholder}
              maxLength={current.options.maxLength}
              onChange={(e) => setValue(e.target.value)}
              aria-label={current.message}
              data-testid="dialog-input"
            />
          ))}
      </form>
    </Modal>
  );
}
