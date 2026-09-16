"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Inbox, MessageCircle } from "lucide-react";
import { useFormat, useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

export interface FeedbackItem {
  id: string;
  projectId: string;
  project: string;
  kind: string;
  status: string;
  title: string;
  author: string;
  replies: number;
  at: string;
}

const KIND_TONE: Record<string, string> = { idea: "text-amber-300", bug: "text-red-400", question: "text-sky-300" };

/** Feedback-Eingang (#59): Beiträge zu den eigenen Community-Projekten an einem Ort. */
export function FeedbackInbox({ items }: { items: FeedbackItem[] }) {
  const t = useT("community");
  const f = useFormat();
  const [openOnly, setOpenOnly] = useState(true);
  const [kind, setKind] = useState<string | null>(null);
  const shown = useMemo(() => items.filter((i) => (!openOnly || i.status === "open") && (!kind || i.kind === kind)), [items, openOnly, kind]);
  const openCount = items.filter((i) => i.status === "open").length;

  return (
    <section className="glass p-6 sm:p-8" aria-labelledby="feedback-heading" data-testid="feedback-inbox">
      <h2 id="feedback-heading" className="flex items-center gap-2 text-lg font-semibold">
        <Inbox size={18} className="text-accent-ink" /> {t("inbox.title")}
        {openCount > 0 && <span className="rounded-full bg-accent/20 px-2 text-xs tabular-nums text-accent-ink">{openCount}</span>}
      </h2>
      <p className="mb-4 text-sm text-muted">{t("inbox.hint")}</p>
      <div className="mb-3 flex flex-wrap gap-2">
        <button type="button" className={cn("chip", openOnly && "chip-active")} onClick={() => setOpenOnly(true)}>
          {t("filters.open")}
        </button>
        <button type="button" className={cn("chip", !openOnly && "chip-active")} onClick={() => setOpenOnly(false)}>
          {t("filters.all")}
        </button>
        <span className="mx-1 w-px bg-fg/10" />
        {(["idea", "question", "bug"] as const).map((k) => (
          <button key={k} type="button" className={cn("chip", kind === k && "chip-active")} onClick={() => setKind(kind === k ? null : k)}>
            {t(`kinds.${k}`)}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="text-sm text-muted">{items.length === 0 ? t("inbox.empty") : t("inbox.emptyFilter")}</p>
      ) : (
        <ul className="divide-y divide-fg/10">
          {shown.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2" data-testid="feedback-item">
              <span className={cn("chip !py-0.5 text-[11px]", KIND_TONE[i.kind])}>{t(`kinds.${i.kind as "idea" | "question" | "bug"}`)}</span>
              <Link href={`/community/${i.projectId}#post-${i.id}`} className="min-w-0 flex-1 truncate font-medium hover:text-accent-ink">
                {i.title}
              </Link>
              <span className="text-xs text-muted">{i.project}</span>
              <span className="text-xs text-muted">{i.author}</span>
              <span className="inline-flex items-center gap-1 text-xs text-muted">
                <MessageCircle size={12} /> {i.replies}
              </span>
              <span className="text-xs text-muted">{t(`statuses.${i.status as "open" | "answered" | "closed"}`)}</span>
              <span className="text-xs text-muted" suppressHydrationWarning>
                {f.ago(i.at)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
