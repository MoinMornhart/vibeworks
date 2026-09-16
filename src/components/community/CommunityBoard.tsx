"use client";

import { useEffect, useState } from "react";
import { useDraft } from "@/lib/client/draft";
import Link from "next/link";
import { EyeOff, Flag, MessageCircle, Send } from "lucide-react";
import type { PostItem } from "@/lib/community";
import { MAX_BODY, MAX_TITLE, POST_KINDS, type PostKind } from "@/lib/communityLogic";
import { api, ApiClientError, errorMessage } from "@/lib/client/api";
import { FormError } from "@/components/ui/FormError";
import { useFormat, useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { Avatar, KindBadge, StatusBadge } from "./ui";

interface Ban {
  userId: string;
  name: string;
  username: string;
  reason: string | null;
  createdAt: string;
}

/** Beiträge eines Projekts: filtern, neu schreiben; für die Moderation die Sperrliste. */
export function CommunityBoard({ projectId, initialPosts, canWrite, moderator }: { projectId: string; initialPosts: PostItem[]; canWrite: boolean; moderator: boolean }) {
  const t = useT("community");
  const f = useFormat();
  const [posts, setPosts] = useState(initialPosts);
  const [kind, setKind] = useState<PostKind | "all">("all");
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [form, setForm] = useState<{ kind: PostKind; title: string; body: string }>({ kind: "question", title: "", body: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [bans, setBans] = useState<Ban[] | null>(null);
  const draft = useDraft(canWrite ? `post-new:${projectId}` : null, form, setForm, (f) => !f.title.trim() && !f.body.trim());

  useEffect(() => {
    if (!moderator) return;
    api<{ bans: Ban[] }>(`/api/community/${projectId}/bans`)
      .then((r) => setBans(r.bans))
      .catch(() => setBans([]));
  }, [moderator, projectId]);

  const shown = posts.filter((p) => (kind === "all" || p.kind === kind) && (!onlyOpen || p.status === "open"));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      const res = await api<{ post: PostItem }>(`/api/community/${projectId}/posts`, { body: form });
      setPosts((list) => [res.post, ...list]);
      setForm({ kind: form.kind, title: "", body: "" });
      draft.discard();
    } catch (err) {
      if (err instanceof ApiClientError) setFieldErrors(err.fieldErrors);
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function unban(userId: string) {
    try {
      setBans((await api<{ bans: Ban[] }>(`/api/community/${projectId}/bans`, { method: "DELETE", body: { userId } })).bans);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="space-y-6">
      <section className="glass p-6 sm:p-8" aria-labelledby="posts-heading">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <h2 id="posts-heading" className="mr-auto text-lg font-semibold">{t("postsTitle")}</h2>
          {(["all", ...POST_KINDS] as const).map((k) => (
            <button key={k} type="button" className={cn("chip", kind === k && "chip-active")} onClick={() => setKind(k)}>
              {k === "all" ? t("filters.all") : t(`kinds.${k}`)}
            </button>
          ))}
          <label className="ml-1 flex cursor-pointer items-center gap-2 text-xs text-muted">
            <input type="checkbox" className="h-3.5 w-3.5 accent-[var(--vw-accent)]" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} />
            {t("filters.open")}
          </label>
        </div>
        {shown.length === 0 ? (
          <p className="text-sm text-muted">{t("noPosts")}</p>
        ) : (
          <ul className="divide-y divide-fg/10" data-testid="community-posts">
            {shown.map((p) => (
              <li key={p.id} id={`post-${p.id}`} className={cn("scroll-mt-24 py-3", p.hidden && "opacity-60")}>
                <Link href={`/community/${projectId}/${p.id}`} className="flex gap-3 rounded-lg transition hover:bg-fg/5">
                  <Avatar name={p.author.name} />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <KindBadge kind={p.kind} />
                      <StatusBadge status={p.status} />
                      {p.hidden && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-amber-400">
                          <EyeOff size={11} /> {t("hiddenBadge")}
                        </span>
                      )}
                      {p.reports > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] text-red-400">
                          <Flag size={11} /> {t("reportsBadge", { n: p.reports })}
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block break-words font-medium">{p.title}</span>
                    <span className="block text-xs text-muted" suppressHydrationWarning>
                      {p.author.name}
                      {p.byOwner && ` · ${t("owner")}`} · {f.ago(p.lastActivityAt)}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1 self-center text-xs text-muted">
                    <MessageCircle size={13} /> {p.replyCount}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="glass p-6 sm:p-8" aria-labelledby="new-post">
        <h2 id="new-post" className="mb-3 text-lg font-semibold">{t("newPost.title")}</h2>
        {!canWrite ? (
          <p className="text-sm text-amber-400">{t("cannotWrite")}</p>
        ) : (
          <form onSubmit={submit} className="space-y-3" data-testid="new-post">
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t("newPost.kind")}>
              {POST_KINDS.map((k) => (
                <button key={k} type="button" role="radio" aria-checked={form.kind === k} className={cn("chip", form.kind === k && "chip-active")} onClick={() => setForm({ ...form, kind: k })}>
                  {t(`kinds.${k}`)}
                </button>
              ))}
            </div>
            <div>
              <label className="label" htmlFor="post-title">{t("newPost.titleLabel")}</label>
              <input id="post-title" className="field" maxLength={MAX_TITLE} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
              {fieldErrors.title && <p className="mt-1 text-xs text-red-400">{fieldErrors.title}</p>}
            </div>
            <div>
              <label className="label" htmlFor="post-body">{t("newPost.body")}</label>
              <textarea id="post-body" className="field min-h-32" maxLength={MAX_BODY} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} required />
              <p className="mt-1 text-xs text-muted">{t("newPost.bodyHint")}</p>
            </div>
            <FormError message={error} />
            <button className="btn btn-primary btn-sm" disabled={busy}>
              <Send size={14} /> {busy ? t("newPost.submitting") : t("newPost.submit")}
            </button>
          </form>
        )}
      </section>

      {moderator && (
        <section className="glass p-6 sm:p-8" aria-labelledby="bans-heading">
          <h2 id="bans-heading" className="mb-3 text-lg font-semibold">{t("bans.title")}</h2>
          {!bans || bans.length === 0 ? (
            <p className="text-sm text-muted">{t("bans.empty")}</p>
          ) : (
            <ul className="space-y-1.5" data-testid="community-bans">
              {bans.map((b) => (
                <li key={b.userId} className="flex items-center gap-3 rounded-xl border bg-bg/25 px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">
                    {b.name} <span className="text-muted">@{b.username}</span>
                  </span>
                  <button type="button" className="btn btn-sm" onClick={() => void unban(b.userId)}>
                    {t("actions.unban")}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
