"use client";

import { useState } from "react";
import { ChevronDown, GitBranch } from "lucide-react";
import { GitProviderFields, type GitConnectionForm } from "@/components/git/GitProviderFields";
import { cn } from "@/lib/utils";

/**
 * Optionale Git-Verbindung beim Anlegen eines Kontos – zugeklappt, mit
 * Anleitung je Anbieter. Lässt sich jederzeit unter „Mein Konto“ nachholen.
 */
export function GitTokenOptional({ value, onChange, error }: { value: GitConnectionForm; onChange: (v: GitConnectionForm) => void; error?: string }) {
  const [open, setOpen] = useState(Boolean(value.token) || Boolean(error));
  return (
    <div className={cn("rounded-xl border bg-bg/30", error && "border-red-500/50")}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm"
      >
        <span className="flex items-center gap-2">
          <GitBranch size={15} className="text-accent-ink" />
          <span className="font-medium">Git verbinden</span>
          <span className="text-muted">(optional)</span>
        </span>
        <ChevronDown size={15} className={cn("text-muted transition", open && "rotate-180")} />
      </button>
      {open && (
        <div className="space-y-3 border-t px-3 pb-3 pt-2.5 text-sm">
          <p className="text-muted">
            Mit GitHub, GitLab oder deinem eigenen Gitea verbunden zeigt VibeWorks die Commits auch aus privaten Repositories und legt deine Aufgaben automatisch als
            Issues an. Du kannst das auch später unter „Mein Konto → Git-Verbindungen“ erledigen.
          </p>
          <GitProviderFields value={value} onChange={onChange} error={error} idPrefix="signup-git" />
        </div>
      )}
    </div>
  );
}
