"use client";

import { useState } from "react";
import { useDraft } from "@/lib/client/draft";
import { useRouter } from "next/navigation";
import { Ban, Check, CheckCircle2, Eye, EyeOff, Flag, Lock, LockOpen, Pencil, Send, Trash2 } from "lucide-react";
import type { PostItem, ReplyItem } from "@/lib/community";
import { MAX_REPLY, REPORT_REASONS, type ReportReason } from "@/lib/communityLogic";
import { api, errorMessage } from "@/lib/client/api";
import { Markdown } from "@/components/Markdown";
import { FormError } from "@/components/ui/FormError";
import { useFormat, useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { Avatar, KindBadge, StatusBadge } from "./ui";

export type Target = { type: "post" | "reply" | "message"; id: string };

export function ReportForm({ target, onDone, onCancel }: { target: Target; onDone: (msg: string) => void; onCancel: () => void }) {
  const t = useT("community");
  const [reason, setReason] = useState<ReportReason>("spam");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  async function send() {
    try {
      await api("/api/community/reports", { body: { targetType: target.type, targetId: target.id, reason, note: note.trim() || null } });
      onDone(t("report.done"));
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  return (
    <div className="mt-2 space-y-2 rounded-xl border bg-bg/30 p-3" data-testid="report-form">
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t("report.reason")}>
        {REPORT_REASONS.map((r) => (
          <button key={r} type="button" role="radio" aria-checked={reason === r} className={cn("chip", reason === r && "chip-active")} onClick={() => setReason(r)}>
            {t(`report.reasons.${r}`)}
          </button>
        ))}
      </div>
      <input className="field" maxLength={300} placeholder={t("report.note")} value={note} onChange={(e) => setNote(e.target.value)} />
      <FormError message={error} />
      <div className="flex gap-2">
        <button type="button" className="btn btn-primary btn-sm" onClick={() => void send()}>
          <Flag size={14} /> {t("report.submit")}
        </button>
        <button type="button" className="btn btn-sm" onClick={onCancel}>{t("actions.cancel")}</button>
      </div>
    </div>
  );
}

/** Beitrag mit Antworten, Antwortfeld und – je nach Rolle – Bearbeiten, Moderieren, Melden. */
export function PostThread({
  projectId,
  initialPost,
  initialReplies,
  canWrite,
  moderator,
  meId,
  ownerId,
}: {
  projectId: string;
  initialPost: PostItem;
  initialReplies: ReplyItem[];
  canWrite: boolean;
  moderator: boolean;
  meId: string;
  ownerId: string;
}) {
  const t = useT("community");
  const f = useFormat();
  const router = useRouter();
  const [post, setPost] = useState(initialPost);
  const [replies, setReplies] = useState(initialReplies);
  const [reply, setReply] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({ title: "", body: "" });
  const [reporting, setReporting] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const replyDraft = useDraft(canWrite ? `reply:${initialPost.id}` : null, reply, setReply, (v) => !v.trim());

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const patchPost = (body: object) =>
    run(async () => {
      setPost((await api<{ post: PostItem }>(`/api/community/posts/${post.id}`, { method: "PATCH", body })).post);
      setEditing(null);
    });

  const patchReply = (id: string, body: object) =>
    run(async () => {
      const res = await api<{ reply: ReplyItem }>(`/api/community/replies/${id}`, { method: "PATCH", body });
      setReplies((list) => list.map((r) => (r.id === id ? res.reply : r)));
      setEditing(null);
    });

  const removePost = () =>
    window.confirm(t("confirmDelete")) &&
    run(async () => {
      await api(`/api/community/posts/${post.id}`, { method: "DELETE" });
      router.push(`/community/${projectId}`);
    });

  const removeReply = (id: string) =>
    window.confirm(t("confirmDelete")) &&
    run(async () => {
      await api(`/api/community/replies/${id}`, { method: "DELETE" });
      setReplies((list) => list.filter((r) => r.id !== id));
      setPost((p) => ({ ...p, replyCount: Math.max(0, p.replyCount - 1) }));
    });

  const ban = (userId: string, name: string) =>
    window.confirm(t("confirmBan", { name })) &&
    run(async () => {
      await api(`/api/community/${projectId}/bans`, { body: { userId } });
      setNotice(t("banned", { name }));
    });

  const resolve = (target: Target) =>
    run(async () => {
      await api("/api/community/reports/resolve", { body: { targetType: target.type, targetId: target.id } });
      if (target.type === "post") setPost((p) => ({ ...p, reports: 0 }));
      else setReplies((list) => list.map((r) => (r.id === target.id ? { ...r, reports: 0 } : r)));
    });

  async function send(e: React.FormEvent) {
    e.preventDefault();
    await run(async () => {
      const res = await api<{ reply: ReplyItem; post: PostItem }>(`/api/community/posts/${post.id}/replies`, { body: { body: reply } });
      setReplies((list) => [...list, res.reply]);
      setPost(res.post);
      setReply("");
      replyDraft.discard();
    });
  }

  function Actions({ item, target }: { item: PostItem | ReplyItem; target: Target }) {
    const mine = item.author.id === meId;
    return (
      <div className="mt-2 flex flex-wrap gap-1.5">
        {item.canEdit && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={busy}
            onClick={() => {
              setEditing(target.id);
              setDraft({ title: "title" in item ? item.title : "", body: item.body });
            }}
          >
            <Pencil size={13} /> {t("actions.edit")}
          </button>
        )}
        {moderator && (
          <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void (target.type === "post" ? patchPost({ hidden: !item.hidden }) : patchReply(target.id, { hidden: !item.hidden }))}>
            {item.hidden ? <Eye size={13} /> : <EyeOff size={13} />} {item.hidden ? t("actions.unhide") : t("actions.hide")}
          </button>
        )}
        {moderator && item.reports > 0 && (
          <button type="button" className="btn btn-ghost btn-sm text-red-400" disabled={busy} onClick={() => void resolve(target)}>
            <Check size={13} /> {t("actions.resolve")} ({item.reports})
          </button>
        )}
        {moderator && !mine && item.author.id !== ownerId && (
          <button type="button" className="btn btn-ghost btn-sm hover:!text-red-400" disabled={busy} onClick={() => void ban(item.author.id, item.author.name)}>
            <Ban size={13} /> {t("actions.ban")}
          </button>
        )}
        {!mine && (
          <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setReporting(reporting === target.id ? null : target.id)}>
            <Flag size={13} /> {t("actions.report")}
          </button>
        )}
        {item.canDelete && (
          <button type="button" className="btn btn-ghost btn-sm hover:!text-red-400" disabled={busy} onClick={() => void (target.type === "post" ? removePost() : removeReply(target.id))}>
            <Trash2 size={13} /> {t("actions.delete")}
          </button>
        )}
      </div>
    );
  }

  const closed = post.status === "closed";
  const canChangeStatus = moderator || post.canEdit;

  return (
    <div className="space-y-4">
      <article className={cn("glass p-6 sm:p-8", post.hidden && "opacity-70")} data-testid="community-post">
        <div className="flex flex-wrap items-center gap-2">
          <KindBadge kind={post.kind} />
          <StatusBadge status={post.status} />
          {post.hidden && (
            <span className="inline-flex items-center gap-1 text-xs text-amber-400">
              <EyeOff size={12} /> {t("hiddenBadge")}
            </span>
          )}
        </div>
        {editing === post.id ? (
          <div className="mt-3 space-y-2">
            <input className="field" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} aria-label={t("newPost.titleLabel")} />
            <textarea className="field min-h-32" value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} aria-label={t("newPost.body")} />
            <div className="flex gap-2">
              <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void patchPost({ title: draft.title, body: draft.body })}>
                {t("actions.save")}
              </button>
              <button type="button" className="btn btn-sm" onClick={() => setEditing(null)}>{t("actions.cancel")}</button>
            </div>
          </div>
        ) : (
          <>
            <h1 className="mt-2 break-words text-2xl font-bold tracking-tight">{post.title}</h1>
            <p className="mt-1 flex items-center gap-2 text-sm text-muted" suppressHydrationWarning>
              <Avatar name={post.author.name} /> {post.author.name}
              {post.byOwner && <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] text-accent-ink">{t("owner")}</span>} · {f.ago(post.createdAt)}
              {post.edited && ` · ${t("edited")}`}
            </p>
            <div className="mt-4">
              <Markdown>{post.body}</Markdown>
            </div>
          </>
        )}
        <Actions item={post} target={{ type: "post", id: post.id }} />
        {canChangeStatus && (
          <div className="mt-1 flex flex-wrap gap-1.5">
            {moderator && post.kind === "question" && post.status === "open" && (
              <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void patchPost({ status: "answered" })}>
                <CheckCircle2 size={13} /> {t("actions.answered")}
              </button>
            )}
            <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void patchPost({ status: closed ? "open" : "closed" })}>
              {closed ? <LockOpen size={13} /> : <Lock size={13} />} {closed ? t("actions.reopen") : t("actions.close")}
            </button>
          </div>
        )}
        {reporting === post.id && <ReportForm target={{ type: "post", id: post.id }} onCancel={() => setReporting(null)} onDone={(m) => (setReporting(null), setNotice(m))} />}
      </article>

      <section className="glass p-6 sm:p-8" aria-labelledby="replies-heading">
        <h2 id="replies-heading" className="mb-3 text-lg font-semibold">{t("replies", { n: post.replyCount })}</h2>
        <ol className="space-y-4" data-testid="community-replies">
          {replies.map((r) => (
            <li key={r.id} id={`r-${r.id}`} className={cn("rounded-xl border bg-bg/25 p-4", r.hidden && "opacity-60", r.byOwner && "border-accent/40")}>
              <p className="flex flex-wrap items-center gap-2 text-sm text-muted" suppressHydrationWarning>
                <Avatar name={r.author.name} /> <span className="text-fg">{r.author.name}</span>
                {r.byOwner && <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] text-accent-ink">{t("owner")}</span>} · {f.ago(r.createdAt)}
                {r.edited && ` · ${t("edited")}`}
                {r.hidden && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-amber-400">
                    <EyeOff size={11} /> {t("hiddenBadge")}
                  </span>
                )}
              </p>
              {editing === r.id ? (
                <div className="mt-2 space-y-2">
                  <textarea className="field min-h-24" value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} aria-label={t("reply.label")} />
                  <div className="flex gap-2">
                    <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void patchReply(r.id, { body: draft.body })}>
                      {t("actions.save")}
                    </button>
                    <button type="button" className="btn btn-sm" onClick={() => setEditing(null)}>{t("actions.cancel")}</button>
                  </div>
                </div>
              ) : (
                <div className="mt-2">
                  <Markdown>{r.body}</Markdown>
                </div>
              )}
              <Actions item={r} target={{ type: "reply", id: r.id }} />
              {reporting === r.id && <ReportForm target={{ type: "reply", id: r.id }} onCancel={() => setReporting(null)} onDone={(m) => (setReporting(null), setNotice(m))} />}
            </li>
          ))}
        </ol>

        {closed && !moderator ? (
          <p className="mt-4 text-sm text-muted">{t("reply.closed")}</p>
        ) : !canWrite ? (
          <p className="mt-4 text-sm text-amber-400">{t("cannotWrite")}</p>
        ) : (
          <form onSubmit={send} className="mt-5 space-y-2" data-testid="reply-form">
            <label className="label" htmlFor="reply-body">{t("reply.label")}</label>
            <textarea id="reply-body" className="field min-h-24" maxLength={MAX_REPLY} placeholder={t("reply.placeholder")} value={reply} onChange={(e) => setReply(e.target.value)} required />
            <button className="btn btn-primary btn-sm" disabled={busy || !reply.trim()}>
              <Send size={14} /> {busy ? t("reply.submitting") : t("reply.submit")}
            </button>
          </form>
        )}
        {notice && (
          <p role="status" className="mt-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
            {notice}
          </p>
        )}
        <FormError message={error} />
      </section>
    </div>
  );
}
