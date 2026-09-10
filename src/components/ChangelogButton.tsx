"use client";

import { useState } from "react";
import { GitCommitHorizontal } from "lucide-react";
import { CHANGELOG, type ChangeType } from "@/lib/changelog";
import type { PublicBuildInfo } from "@/lib/buildInfo";
import { Modal } from "@/components/ui/Modal";
import { formatDate, formatDateTime } from "@/lib/utils";

const TYPE_LABEL: Record<ChangeType, { text: string; cls: string }> = {
  neu: { text: "Neu", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  besser: { text: "Besser", cls: "bg-sky-500/15 text-sky-400 border-sky-500/30" },
  fix: { text: "Behoben", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
};

export function ChangelogButton({ build }: { build: PublicBuildInfo }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="hover:text-fg hover:underline" onClick={() => setOpen(true)}>
        Version {build.version}
        {build.shortCommit && <span className="font-mono"> · {build.shortCommit}</span>}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Was ist neu?" size="lg">
        <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border bg-bg/30 px-4 py-3 text-sm">
          <span>
            Installiert: <strong>Version {build.version}</strong>
          </span>
          {build.count !== null && <span className="text-muted">Update Nr. {build.count}</span>}
          {build.shortCommit && (
            <span className="inline-flex items-center gap-1 text-muted">
              <GitCommitHorizontal size={14} />
              {build.commitUrl ? (
                <a href={build.commitUrl} target="_blank" rel="noopener noreferrer" className="font-mono text-accent-ink hover:underline">{build.shortCommit}</a>
              ) : (
                <span className="font-mono">{build.shortCommit}</span>
              )}
              {build.dirty && <span>(mit lokalen Änderungen)</span>}
            </span>
          )}
          {build.commitDate && <span className="text-muted">vom {formatDateTime(build.commitDate)}</span>}
        </div>
        <ol className="space-y-6">
          {CHANGELOG.map((entry) => (
            <li key={entry.version}>
              <div className="flex flex-wrap items-baseline gap-x-3">
                <span className="font-mono text-sm text-accent-ink">v{entry.version}</span>
                <span className="font-semibold">{entry.title}</span>
                <span className="text-xs text-muted">{formatDate(entry.date)}</span>
                {entry.version === build.version && (
                  <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent-ink">installiert</span>
                )}
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
