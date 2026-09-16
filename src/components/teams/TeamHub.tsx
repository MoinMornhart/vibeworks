"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { TaskStatus } from "@/generated/prisma/client";
import { Activity, ArrowLeft, Bot, Check, FolderKanban, Lightbulb, MessageSquare, Send, UsersRound, X } from "lucide-react";
import type { TeamChatMessage, TeamHubView } from "@/lib/teamHub";
import { MAX_TEAM_MESSAGE, MAX_WISH_BODY, MAX_WISH_TITLE } from "@/lib/teamHubLogic";
import { api, errorMessage } from "@/lib/client/api";
import { FormError } from "@/components/ui/FormError";
import { useFormat, useT } from "@/lib/i18n/client";
import { roleName } from "@/components/roles/roleName";
import { WorkClock } from "@/components/tasks/TaskInfoPanel";
import { cn } from "@/lib/utils";

const CHAT_POLL_MS = 15_000;

const STATUS_TONE: Record<TaskStatus, string> = {
  DOING: "border-accent/50 bg-accent/15 text-accent-ink",
  BLOCKED: "border-red-500/40 bg-red-500/10 text-red-400",
  TODO: "text-muted",
  DONE: "text-emerald-400",
};
const WISH_TONE = { open: "text-amber-400 border-amber-500/40", accepted: "text-emerald-400 border-emerald-500/40", declined: "text-muted" } as const;

function Card({ icon, title, hint, children, testId }: { icon: React.ReactNode; title: string; hint?: string; children: React.ReactNode; testId?: string }) {
  return (
    <section className="glass p-5 sm:p-6" data-testid={testId}>
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <span className="text-accent-ink">{icon}</span> {title}
      </h2>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Team-Seite: Mitglieder, Projekte, woran Claude arbeitet, Wünsche, Chat und Aktivität (#38). */
export function TeamHub({ initial, meId }: { initial: TeamHubView; meId: string }) {
  const t = useT("teamHub");
  const ts = useT("status");
  const tr = useT("roles");
  const f = useFormat();
  const [hub, setHub] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [wish, setWish] = useState({ title: "", body: "" });
  const [target, setTarget] = useState<Record<string, string>>({});
  const [chat, setChat] = useState<TeamChatMessage[] | null>(null);
  const [text, setText] = useState("");
  const listRef = useRef<HTMLOListElement>(null);

  const loadChat = useCallback(() => {
    api<{ messages: TeamChatMessage[] }>(`/api/teams/${hub.id}/chat`)
      .then((r) => setChat(r.messages))
      .catch(() => undefined);
  }, [hub.id]);
  useEffect(() => {
    loadChat();
    const timer = window.setInterval(() => document.visibilityState === "visible" && loadChat(), CHAT_POLL_MS);
    return () => window.clearInterval(timer);
  }, [loadChat]);
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat]);

  async function run(fn: () => Promise<{ hub: TeamHubView }>) {
    setBusy(true);
    setError(null);
    try {
      setHub((await fn()).hub);
      return true;
    } catch (e) {
      setError(errorMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function submitWish(e: React.FormEvent) {
    e.preventDefault();
    if (await run(() => api(`/api/teams/${hub.id}/wishes`, { body: { title: wish.title, body: wish.body || null } }))) setWish({ title: "", body: "" });
  }
  const accept = (id: string) => {
    const projectId = target[id] ?? hub.acceptProjects[0]?.id;
    if (projectId) void run(() => api(`/api/teams/${hub.id}/wishes/${id}`, { method: "PATCH", body: { action: "accept", projectId } }));
  };
  const decline = (id: string) => {
    const reason = window.prompt(t("wishes.declinePrompt"));
    if (reason !== null) void run(() => api(`/api/teams/${hub.id}/wishes/${id}`, { method: "PATCH", body: { action: "decline", reason: reason.trim() || null } }));
  };
  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    try {
      setChat((await api<{ messages: TeamChatMessage[] }>(`/api/teams/${hub.id}/chat`, { body: { body } })).messages);
      setText("");
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="fade-in space-y-5">
      <header>
        <Link href="/teams" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
          <ArrowLeft size={14} /> {t("back")}
        </Link>
        <h1 className="mt-2 flex items-center gap-3 text-3xl font-bold tracking-tight">
          <UsersRound size={28} className="text-accent-ink" /> {hub.name}
        </h1>
        <p className="mt-1 text-muted">{t("subtitle")}</p>
      </header>
      <FormError message={error} />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card icon={<Bot size={17} />} title={t("ai.title")} hint={t("ai.hint")} testId="hub-ai">
            {hub.ai.length === 0 ? (
              <p className="text-sm text-muted">{t("ai.empty")}</p>
            ) : (
              <ul className="space-y-2">
                {hub.ai.map((x) => (
                  <li key={x.id} className="flex flex-wrap items-center gap-2 rounded-xl border bg-bg/25 px-3 py-2 text-sm" data-testid="hub-ai-task">
                    <span className={cn("chip !py-0.5 text-[11px]", STATUS_TONE[x.status])}>{x.statusLabel || ts(`task.${x.status}`)}</span>
                    <Link href={`/projects/${x.projectId}`} className="min-w-0 flex-1 truncate font-medium hover:text-accent-ink">
                      {x.title}
                    </Link>
                    <span className="text-xs text-muted">{x.project}</span>
                    {x.status === "DOING" ? (
                      <WorkClock since={x.since} who="Claude" />
                    ) : (
                      <span className="text-xs text-muted" suppressHydrationWarning>
                        {f.ago(x.updatedAt)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <h3 className="mb-1 mt-4 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
              <Activity size={13} /> {t("ai.steps")}
            </h3>
            {hub.aiSteps.length === 0 ? (
              <p className="text-xs text-muted">{t("ai.noSteps")}</p>
            ) : (
              <ul className="divide-y divide-fg/10 text-sm" data-testid="hub-ai-steps">
                {hub.aiSteps.map((s, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-x-2 py-1">
                    <code className={cn("text-xs", !s.ok && "text-amber-400")}>{s.tool}</code>
                    <Link href={`/projects/${s.projectId}`} className="min-w-0 flex-1 truncate hover:text-accent-ink">
                      {s.task}
                    </Link>
                    <span className="text-xs text-muted">{s.project}</span>
                    <span className="text-xs text-muted" suppressHydrationWarning>
                      {f.ago(s.at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card icon={<Lightbulb size={17} />} title={t("wishes.title")} hint={t("wishes.hint", { n: hub.wishLimit })} testId="hub-wishes">
            <form onSubmit={submitWish} className="mb-4 space-y-2 rounded-xl border bg-bg/25 p-3">
              <input
                className="field"
                maxLength={MAX_WISH_TITLE}
                placeholder={t("wishes.titlePlaceholder")}
                aria-label={t("wishes.titleLabel")}
                value={wish.title}
                onChange={(e) => setWish({ ...wish, title: e.target.value })}
              />
              <textarea
                className="field min-h-16"
                maxLength={MAX_WISH_BODY}
                placeholder={t("wishes.bodyLabel")}
                aria-label={t("wishes.bodyLabel")}
                value={wish.body}
                onChange={(e) => setWish({ ...wish, body: e.target.value })}
              />
              <div className="flex flex-wrap items-center gap-2">
                <button className="btn btn-primary btn-sm" disabled={busy || hub.wishesLeft === 0 || wish.title.trim().length < 3}>
                  <Send size={14} /> {t("wishes.submit")}
                </button>
                <span className={cn("text-xs", hub.wishesLeft === 0 ? "text-amber-400" : "text-muted")} data-testid="wishes-left">
                  {t("wishes.left", { n: hub.wishesLeft })}
                </span>
              </div>
            </form>
            {hub.wishes.length === 0 ? (
              <p className="text-sm text-muted">{t("wishes.none")}</p>
            ) : (
              <ul className="space-y-2">
                {hub.wishes.map((w) => (
                  <li key={w.id} className="rounded-xl border bg-bg/25 px-3 py-2" data-testid="hub-wish">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn("chip !py-0.5 text-[11px]", WISH_TONE[w.status])}>{t(`wishes.status.${w.status}`)}</span>
                      <span className="min-w-0 flex-1 break-words text-sm font-medium">{w.title}</span>
                      <span className="text-xs text-muted" suppressHydrationWarning>
                        {t("wishes.by", { name: w.author })} · {f.ago(w.at)}
                      </span>
                    </div>
                    {w.body && <p className="mt-1 whitespace-pre-line text-sm text-muted">{w.body}</p>}
                    {w.status === "declined" && w.reason && <p className="mt-1 text-xs text-muted">{t("wishes.reason", { reason: w.reason })}</p>}
                    {w.status === "accepted" && w.projectId && (
                      <Link href={`/projects/${w.projectId}`} className="mt-1 inline-block text-xs text-accent-ink hover:underline">
                        {t("wishes.taskLink")}
                      </Link>
                    )}
                    {hub.manage && w.status === "open" && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {hub.acceptProjects.length > 0 ? (
                          <>
                            <label className="text-xs text-muted" htmlFor={`wish-target-${w.id}`}>
                              {t("wishes.into")}
                            </label>
                            <select
                              id={`wish-target-${w.id}`}
                              className="field !w-auto !py-1 text-xs"
                              value={target[w.id] ?? hub.acceptProjects[0].id}
                              onChange={(e) => setTarget((s) => ({ ...s, [w.id]: e.target.value }))}
                            >
                              {hub.acceptProjects.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                            </select>
                            <button type="button" className="btn btn-sm" disabled={busy} onClick={() => accept(w.id)}>
                              <Check size={13} /> {t("wishes.accept")}
                            </button>
                          </>
                        ) : (
                          <span className="text-xs text-muted">{t("wishes.noProject")}</span>
                        )}
                        <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => decline(w.id)}>
                          <X size={13} /> {t("wishes.decline")}
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card icon={<MessageSquare size={17} />} title={t("chat.title")} hint={t("chat.hint")} testId="hub-chat">
            <ol ref={listRef} className="max-h-80 space-y-2 overflow-y-auto pr-1">
              {chat === null ? null : chat.length === 0 ? (
                <li className="text-sm text-muted">{t("chat.empty")}</li>
              ) : (
                chat.map((m) => (
                  <li key={m.id} className={cn("max-w-[85%] rounded-xl border px-3 py-1.5 text-sm", m.authorId === meId ? "ml-auto border-accent/40 bg-accent/10" : "bg-bg/25")} data-testid="hub-chat-message">
                    <span className="block text-[11px] text-muted" suppressHydrationWarning>
                      {m.author} · {f.ago(m.at)}
                    </span>
                    <span className="whitespace-pre-line break-words">{m.body}</span>
                  </li>
                ))
              )}
            </ol>
            <form onSubmit={send} className="mt-3 flex gap-2">
              <input className="field min-w-0 flex-1" maxLength={MAX_TEAM_MESSAGE} placeholder={t("chat.placeholder")} aria-label={t("chat.placeholder")} value={text} onChange={(e) => setText(e.target.value)} />
              <button className="btn btn-primary btn-sm" disabled={!text.trim()}>
                <Send size={14} /> {t("chat.send")}
              </button>
            </form>
          </Card>
        </div>

        <div className="space-y-5">
          <Card icon={<UsersRound size={17} />} title={t("members")} testId="hub-members">
            <ul className="space-y-1.5">
              {hub.members.map((m) => (
                <li key={m.userId} className="flex items-center gap-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">
                    {m.name} <span className="text-muted">@{m.username}</span>
                  </span>
                  {m.role && <span className="chip !py-0.5 text-[11px]">{roleName(m.role, tr)}</span>}
                </li>
              ))}
            </ul>
          </Card>
          <Card icon={<FolderKanban size={17} />} title={t("projects")} testId="hub-projects">
            {hub.projects.length === 0 ? (
              <p className="text-sm text-muted">{t("noProjects")}</p>
            ) : (
              <ul className="space-y-1.5">
                {hub.projects.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-2 text-sm">
                    <Link href={`/projects/${p.id}`} className="min-w-0 flex-1 truncate font-medium hover:text-accent-ink">
                      {p.name}
                    </Link>
                    <span className="chip !py-0.5 text-[11px]">{t("openTasks", { n: p.openTasks })}</span>
                    {p.openErrors > 0 && <span className="chip !py-0.5 border-red-500/40 text-[11px] text-red-400">{t("openErrors", { n: p.openErrors })}</span>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card icon={<Activity size={17} />} title={t("activity.title")} testId="hub-activity">
            {hub.activity.length === 0 ? (
              <p className="text-sm text-muted">{t("activity.empty")}</p>
            ) : (
              <ul className="space-y-2 text-xs">
                {hub.activity.map((a) => (
                  <li key={a.id}>
                    <span className="block text-sm">{a.summary}</span>
                    <span className="text-muted" suppressHydrationWarning>
                      {a.project}
                      {a.user ? ` · ${a.user}` : ""} · {f.ago(a.at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
