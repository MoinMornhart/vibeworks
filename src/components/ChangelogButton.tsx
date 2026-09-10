"use client";

import { useState } from "react";
import { CHANGELOG, CURRENT_VERSION, type ChangeType } from "@/lib/changelog";
import { Modal } from "@/components/ui/Modal";
import { formatDate } from "@/lib/utils";

const TYPE_LABEL: Record<ChangeType, { text: string; cls: string }> = {
  neu: { text: "Neu", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  besser: { text: "Besser", cls: "bg-sky-500/15 text-sky-400 border-sky-500/30" },
  fix: { text: "Behoben", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
};

export function ChangelogButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="hover:text-fg hover:underline" onClick={() => setOpen(true)}>
        Version {CURRENT_VERSION}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Was ist neu?" size="lg">
        <ol className="space-y-6">
          {CHANGELOG.map((entry) => (
            <li key={entry.version}>
              <div className="flex flex-wrap items-baseline gap-x-3">
                <span className="font-mono text-sm text-accent-ink">v{entry.version}</span>
                <span className="font-semibold">{entry.title}</span>
                <span className="text-xs text-muted">{formatDate(entry.date)}</span>
              </div>
              <ul className="mt-2 space-y-1.5">
                {entry.changes.map((c, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className={`mt-0.5 shrink-0 rounded-md border px-1.5 text-[11px] font-medium ${TYPE_LABEL[c.type].cls}`}>{TYPE_LABEL[c.type].text}</span>
                    <span>{c.text}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </Modal>
    </>
  );
}
