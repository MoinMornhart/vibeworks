"use client";

import { Bug, HelpCircle, Lightbulb } from "lucide-react";
import type { PostKind, PostStatus } from "@/lib/communityLogic";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

// Kleine Bausteine, die Übersicht und Beitragsseite teilen.

const KIND_ICON: Record<PostKind, typeof Bug> = { question: HelpCircle, idea: Lightbulb, bug: Bug };
const KIND_TONE: Record<PostKind, string> = { question: "text-sky-400", idea: "text-amber-400", bug: "text-red-400" };
const STATUS_TONE: Record<PostStatus, string> = {
  open: "bg-sky-500/15 text-sky-400",
  answered: "bg-emerald-500/15 text-emerald-400",
  closed: "bg-fg/10 text-muted",
};

export function KindBadge({ kind }: { kind: PostKind }) {
  const t = useT("community");
  const Icon = KIND_ICON[kind];
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium", KIND_TONE[kind])}>
      <Icon size={13} /> {t(`kinds.${kind}`)}
    </span>
  );
}

export function StatusBadge({ status }: { status: PostStatus }) {
  const t = useT("community");
  return <span className={cn("rounded-full px-2 py-0.5 text-[11px]", STATUS_TONE[status])}>{t(`statuses.${status}`)}</span>;
}

export function Avatar({ name }: { name: string }) {
  return (
    <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-bold text-accent-ink">
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}
