"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  CircleSlash,
  Clock,
  Copy,
  ExternalLink,
  GitBranch,
  GitCommitHorizontal,
  KeyRound,
  Loader2,
  RefreshCw,
  Star,
  TriangleAlert,
  Users,
  Webhook,
  XCircle,
} from "lucide-react";
import type { RepoCacheView } from "@/lib/git/sync";
import type { CiState, CiStatus } from "@/lib/git/ci";
import type { IssueSyncResult } from "@/lib/git/issues";
import type { CommitInfo } from "@/lib/git/providers";
import { guessProvider, parseRepoUrl, PROVIDER_LABEL, type GitProvider } from "@/lib/git/parse";
import { api, errorMessage } from "@/lib/client/api";
import { FormError } from "@/components/ui/FormError";
import { useFormat, useLocale, useMsg, useT } from "@/lib/i18n/client";
import { INTL_LOCALE, type Locale } from "@/lib/i18n/config";
import type { TFunction } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";
import { richText } from "./GitProviderFields";

interface Access {
  tokenHint: string | null;
  issueSync: boolean;
  /** Konto-Token des Besitzers, das greift, wenn das Projekt kein eigenes hat */
  accountToken?: { hint: string | null; login: string | null } | null;
  /** Eingehender Webhook – nur für den Besitzer */
  webhook?: { url: string; secret: string; receivedAt: string | null; publicUrl: boolean } | null;
}

type WebhookAction = "on" | "renew" | "off" | "install";

const STALE_MS = 5 * 60_000;
const PAGE = 20;
const CHART_DAYS = 30;

// So legt der Server Commits ohne Nachricht bzw. ohne Autor ab (siehe parse.ts, providers.ts).
const STORED_NO_MESSAGE = "(ohne Nachricht)";
const STORED_UNKNOWN_AUTHOR = "unbekannt";

const pad = (n: number) => String(n).padStart(2, "0");
const localDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function dayLabel(key: string, today: Date, t: TFunction<"git">, locale: Locale): string {
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (key === localDay(today)) return t("commits.today");
  if (key === localDay(yesterday)) return t("commits.yesterday");
  const d = new Date(`${key}T12:00:00`);
  return d.toLocaleDateString(INTL_LOCALE[locale], { weekday: "short", day: "numeric", month: "long", year: d.getFullYear() === today.getFullYear() ? undefined : "numeric" });
}

function hue(name: string): number {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

function initials(name: string): string {
  const parts = name.replace(/[^\p{L}\p{N} ]/gu, " ").trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "?") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

function Avatar({ name }: { name: string }) {
  const h = hue(name);
  return (
    <span
      aria-hidden
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ring-2 ring-bg"
      style={{ background: `hsl(${h} 70% 50% / 0.22)`, color: `hsl(${h} 85% 72%)` }}
    >
      {initials(name)}
    </span>
  );
}

function issueBaseOf(cache: RepoCacheView): string | null {
  if (!cache.webUrl) return null;
  return cache.provider === "gitlab" ? `${cache.webUrl}/-/issues` : `${cache.webUrl}/issues`;
}

/** Titel mit verlinkten Issue-Nummern und Versions-Plakette „(0.2.4)“ am Ende. */
function CommitTitle({ text, issueBase }: { text: string; issueBase: string | null }) {
  const version = text.match(/\s*\((\d+\.\d+\.\d+)\)\s*$/);
  const main = version ? text.slice(0, version.index) : text;
  return (
    <>
      {main.split(/(#\d+)/g).map((part, i) =>
        /^#\d+$/.test(part) && issueBase ? (
          <a key={i} href={`${issueBase}/${part.slice(1)}`} target="_blank" rel="noopener noreferrer" className="text-accent-ink hover:underline">
            {part}
          </a>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
      {version && <span className="ml-2 inline-block rounded-md bg-accent/15 px-1.5 py-px align-middle font-mono text-[11px] font-normal text-accent-ink">v{version[1]}</span>}
    </>
  );
}

function CommitRow({ commit, issueBase, last }: { commit: CommitInfo; issueBase: string | null; last: boolean }) {
  const t = useT("git");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const time = new Date(commit.date).toLocaleTimeString(INTL_LOCALE[locale], { hour: "2-digit", minute: "2-digit" });
  const author = commit.author === STORED_UNKNOWN_AUTHOR ? t("commits.unknownAuthor") : commit.author;
  return (
    <li className="relative flex gap-3 pb-4">
      {!last && <span aria-hidden className="absolute left-4 top-9 bottom-0 w-px bg-fg/10" />}
      <Avatar name={commit.author} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <p className="min-w-0 flex-1 break-words text-sm font-medium leading-snug">
            {commit.title === STORED_NO_MESSAGE ? t("commits.noMessage") : <CommitTitle text={commit.title} issueBase={issueBase} />}
          </p>
          {commit.url ? (
            <a
              href={commit.url}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 rounded-md border bg-bg/40 px-1.5 py-px font-mono text-[11px] text-muted transition hover:border-accent/50 hover:text-fg"
              title={t("commits.open")}
            >
              {commit.sha.slice(0, 7)}
            </a>
          ) : (
            <span className="shrink-0 rounded-md border px-1.5 py-px font-mono text-[11px] text-muted">{commit.sha.slice(0, 7)}</span>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
          <span>{author}</span>
          <span aria-hidden>·</span>
          <time dateTime={commit.date} title={new Date(commit.date).toLocaleString(INTL_LOCALE[locale])}>{time}</time>
          {commit.body && (
            <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="inline-flex items-center gap-0.5 hover:text-fg">
              {t("commits.details")} <ChevronDown size={12} className={cn("transition", open && "rotate-180")} />
            </button>
          )}
        </div>
        {open && commit.body && (
          <pre className="mt-2 whitespace-pre-wrap break-words rounded-lg border bg-bg/40 p-3 font-mono text-xs leading-relaxed text-muted">{commit.body}</pre>
        )}
      </div>
    </li>
  );
}

function ActivityChart({ commits, today }: { commits: CommitInfo[]; today: Date }) {
  const t = useT("git");
  const locale = useLocale();
  const days = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of commits) {
      const k = localDay(new Date(c.date));
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return Array.from({ length: CHART_DAYS }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (CHART_DAYS - 1 - i));
      const key = localDay(d);
      return { key, count: counts.get(key) ?? 0, label: d.toLocaleDateString(INTL_LOCALE[locale], { day: "numeric", month: "short" }) };
    });
  }, [commits, today, locale]);
  const max = Math.max(1, ...days.map((d) => d.count));
  const total = days.reduce((s, d) => s + d.count, 0);
  return (
    <figure className="rounded-2xl border bg-bg/25 p-3">
      <figcaption className="mb-2 flex justify-between text-xs text-muted">
        <span>{t("chart.title", { days: CHART_DAYS })}</span>
        <span className="tabular-nums">{t("chart.total", { n: total })}</span>
      </figcaption>
      <div className="flex h-14 items-end gap-[3px]" role="img" aria-label={t("chart.aria", { n: total, days: CHART_DAYS })}>
        {days.map((d) => (
          <div
            key={d.key}
            title={t("chart.day", { date: d.label, n: d.count })}
            className={cn("flex-1 rounded-sm transition-all", d.count ? "bg-accent" : "bg-fg/10")}
            style={{ height: d.count ? `${Math.max(14, (d.count / max) * 100)}%` : "8%", opacity: d.count ? 0.45 + 0.55 * (d.count / max) : 1 }}
          />
        ))}
      </div>
    </figure>
  );
}

function Stat({ icon: Icon, label, value, hint }: { icon: typeof Star; label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border bg-bg/25 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-xs text-muted"><Icon size={13} /> {label}</div>
      <div className="mt-0.5 truncate text-lg font-semibold tabular-nums" title={hint}>{value}</div>
    </div>
  );
}

const CI_STYLE: Record<CiState, { icon: typeof Star; className: string; spin?: boolean }> = {
  success: { icon: CheckCircle2, className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400" },
  failure: { icon: XCircle, className: "border-red-500/40 bg-red-500/10 text-red-400" },
  running: { icon: Loader2, className: "border-amber-500/40 bg-amber-500/10 text-amber-400", spin: true },
  pending: { icon: Clock, className: "border-amber-500/40 bg-amber-500/10 text-amber-400" },
  canceled: { icon: CircleSlash, className: "text-muted" },
};

function CiIcon({ state, size = 12 }: { state: CiState; size?: number }) {
  const { icon: Icon, spin } = CI_STYLE[state];
  return <Icon size={size} className={cn(spin && "animate-spin")} />;
}

/** „CI: erfolgreich“ – verlinkt auf den jüngsten Lauf. */
function CiBadge({ ci }: { ci: CiStatus }) {
  const t = useT("git");
  const state = t(`ci.state.${ci.state}`);
  const className = cn("chip !py-0.5", CI_STYLE[ci.state].className);
  const url = ci.runs[0]?.url;
  const content = (
    <>
      <CiIcon state={ci.state} /> {t("ci.label")}: {state}
    </>
  );
  return url ? (
    <a href={url} target="_blank" rel="noopener noreferrer" className={className} title={t("ci.badgeTitle", { state })}>
      {content}
    </a>
  ) : (
    <span className={className}>{content}</span>
  );
}

function CiRuns({ ci }: { ci: CiStatus }) {
  const t = useT("git");
  const f = useFormat();
  return (
    <div className="mb-6 rounded-2xl border bg-bg/25 p-3">
      <p className="mb-2 text-xs text-muted">{t("ci.runsTitle")}</p>
      <ul className="space-y-1.5">
        {ci.runs.map((r, i) => (
          <li key={`${r.name}-${i}`} className="flex items-center gap-2 text-sm">
            <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full border", CI_STYLE[r.state].className)}>
              <CiIcon state={r.state} size={11} />
            </span>
            {r.url ? (
              <a href={r.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate hover:text-accent-ink">{r.name}</a>
            ) : (
              <span className="min-w-0 flex-1 truncate">{r.name}</span>
            )}
            <span className="shrink-0 text-xs text-muted">
              {t(`ci.state.${r.state}`)} · <span suppressHydrationWarning>{f.ago(r.updatedAt)}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CopyField({ label, value, secret }: { label: string; value: string; secret?: boolean }) {
  const tc = useT("common");
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Ohne HTTPS gibt es keine Zwischenablage-API – dann markieren und klassisch kopieren.
      ref.current?.select();
      document.execCommand("copy");
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }
  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex gap-2">
        <input ref={ref} readOnly value={value} type={secret ? "password" : "text"} onFocus={(e) => e.target.select()} className="field min-w-0 flex-1 font-mono text-xs" aria-label={label} />
        <button type="button" className="btn btn-sm shrink-0" onClick={() => void copy()}>
          {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? tc("copied") : tc("copy")}
        </button>
      </div>
    </div>
  );
}

function WebhookSection({
  provider,
  access,
  busy,
  note,
  onWebhook,
}: {
  provider: GitProvider | null;
  access: Access;
  busy: boolean;
  note: string | null;
  onWebhook: (action: WebhookAction) => void;
}) {
  const t = useT("git");
  const f = useFormat();
  const hook = access.webhook;
  const hasToken = Boolean(access.tokenHint || access.accountToken);
  return (
    <div className="space-y-3 border-t pt-4">
      <div>
        <p className="flex items-center gap-2 text-sm font-medium">
          <Webhook size={15} className="text-accent-ink" /> {t("webhook.title")}
        </p>
        <p className="text-xs text-muted">{t("webhook.hint")}</p>
      </div>
      {!hook ? (
        <button type="button" className="btn btn-sm" disabled={busy} onClick={() => onWebhook("on")}>
          <Webhook size={14} /> {t("webhook.enable")}
        </button>
      ) : (
        <>
          {!hook.publicUrl && (
            <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">{t("webhook.notPublic", { url: hook.url })}</p>
          )}
          <CopyField label={t("webhook.url")} value={hook.url} />
          <CopyField label={t("webhook.secret")} value={hook.secret} secret />
          <p className="text-xs text-muted" suppressHydrationWarning>
            {hook.receivedAt ? t("webhook.received", { ago: f.ago(hook.receivedAt) }) : t("webhook.never")}
          </p>
          <div className="flex flex-wrap gap-2">
            {provider && hasToken && hook.publicUrl && (
              <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => onWebhook("install")}>
                <Webhook size={14} /> {t("webhook.install", { provider: PROVIDER_LABEL[provider] })}
              </button>
            )}
            <button type="button" className="btn btn-sm" disabled={busy} onClick={() => onWebhook("renew")}>
              <RefreshCw size={14} /> {t("webhook.renew")}
            </button>
            <button type="button" className="btn btn-sm hover:!text-red-400" disabled={busy} onClick={() => window.confirm(t("webhook.confirmRemove")) && onWebhook("off")}>
              {t("webhook.remove")}
            </button>
          </div>
          <details className="text-xs text-muted">
            <summary className="cursor-pointer hover:text-fg">{t("webhook.manualTitle")}</summary>
            <p className="mt-1">{t(`webhook.manual.${provider || "github"}`)}</p>
          </details>
        </>
      )}
      {note && <p role="status" className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-400">{note}</p>}
    </div>
  );
}

function AccessPanel({
  provider,
  access,
  busy,
  error,
  onSave,
  webhookNote,
  onWebhook,
}: {
  provider: GitProvider | null;
  access: Access;
  busy: boolean;
  error: string | null;
  onSave: (body: { token?: string | null; issueSync?: boolean }) => void;
  webhookNote: string | null;
  onWebhook: (action: WebhookAction) => void;
}) {
  const t = useT("git");
  const tc = useT("common");
  const [token, setToken] = useState("");
  return (
    <div className="mb-5 space-y-4 rounded-2xl border bg-bg/30 p-4">
      {access.accountToken && !access.tokenHint ? (
        <p className="flex items-start gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm">
          <CircleDot size={16} className="mt-0.5 shrink-0 text-emerald-400" />
          <span>
            <b>{t("access.accountActive")}</b>
            {access.accountToken.login && <> (@{access.accountToken.login})</>} {t("access.accountActiveHint")}
          </span>
        </p>
      ) : (
        !access.tokenHint && (
          <p className="text-sm text-muted">
            {richText(t("access.tip"), {
              link: <a href="/account#git-zugang" className="text-accent-ink hover:underline">{t("access.tipLink")}</a>,
            })}
          </p>
        )
      )}
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (token.trim()) onSave({ token: token.trim() });
          setToken("");
        }}
      >
        <label className="label" htmlFor="git-token">{t("access.tokenLabel")}</label>
        <div className="flex flex-wrap gap-2">
          <input
            id="git-token"
            type="password"
            autoComplete="off"
            spellCheck={false}
            className="field min-w-0 flex-1 font-mono"
            placeholder={access.tokenHint ? t("access.tokenSaved", { hint: access.tokenHint }) : t("access.tokenPlaceholder")}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            maxLength={500}
          />
          <button type="submit" className="btn btn-primary btn-sm" disabled={busy || !token.trim()}>{tc("save")}</button>
          {access.tokenHint && (
            <button type="button" className="btn btn-sm" disabled={busy} onClick={() => onSave({ token: null })}>{tc("remove")}</button>
          )}
        </div>
        {(provider === "github" || !provider) && (
          <a
            href="https://github.com/settings/tokens/new?scopes=public_repo,admin:repo_hook&description=VibeWorks"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-sm w-full justify-center sm:w-auto"
          >
            <ExternalLink size={14} /> {t("access.createOnGithub")}
          </a>
        )}
        <p className="text-xs text-muted">
          {provider === "github" || !provider ? (
            <>{richText(t("access.githubHelp"), { button: <b>Generate token</b>, prefix: <code>ghp_</code> })} </>
          ) : (
            <>{t(`access.help.${provider}`)} </>
          )}
          {t("access.encrypted")}
        </p>
      </form>

      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 accent-[var(--vw-accent)]"
          checked={access.issueSync}
          disabled={busy}
          onChange={(e) => onSave({ issueSync: e.target.checked })}
        />
        <span className="text-sm">
          <span className="font-medium">{t("access.issueSync")}</span>
          <span className="block text-xs text-muted">{t("access.issueSyncHint")}</span>
        </span>
      </label>
      <WebhookSection provider={provider} access={access} busy={busy} note={webhookNote} onWebhook={onWebhook} />
      <FormError message={error} />
    </div>
  );
}

export function GitPanel({
  projectId,
  repoUrl,
  initialCache,
  initialAccess,
  linkedIssues,
  mode = "owner",
}: {
  projectId: string;
  repoUrl: string | null;
  initialCache: RepoCacheView | null;
  initialAccess: Access;
  linkedIssues: number;
  /** owner: alles · member: abgleichen, kein Token · public: nur der gespeicherte Stand */
  mode?: "owner" | "member" | "public";
}) {
  const t = useT("git");
  const f = useFormat();
  const msg = useMsg();
  const locale = useLocale();
  const canSync = mode !== "public";
  const canManage = mode === "owner";
  const router = useRouter();
  const [cache, setCache] = useState(initialCache);
  const [access, setAccess] = useState(initialAccess);
  const [linked, setLinked] = useState(linkedIssues);
  useEffect(() => setCache(initialCache), [initialCache]);
  useEffect(() => setAccess(initialAccess), [initialAccess]);
  useEffect(() => setLinked(linkedIssues), [linkedIssues]);

  const [issues, setIssues] = useState<IssueSyncResult | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [showAccess, setShowAccess] = useState(false);
  const [accessBusy, setAccessBusy] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [webhookNote, setWebhookNote] = useState<string | null>(null);
  const [shown, setShown] = useState(PAGE);
  // Datum und Zeitzone erst im Browser – sonst passen Server- und Browserdarstellung nicht zusammen.
  const [today, setToday] = useState<Date | null>(null);
  useEffect(() => setToday(new Date()), []);

  const provider = (cache?.provider || guessProvider(parseRepoUrl(repoUrl)?.host ?? "")) as GitProvider | "" | null;

  const sync = useCallback(async () => {
    if (!repoUrl || !canSync || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ cache: RepoCacheView | null; issues: IssueSyncResult | null }>(`/api/projects/${projectId}/git`, { method: "POST", body: {} });
      setCache(res.cache);
      setIssues(res.issues);
      if (res.issues) setLinked(res.issues.linked);
      // Neue Issue-Nummern oder umsortierte Aufgaben → Aufgabenboard neu laden
      if (res.issues && (res.issues.created || res.issues.tasksChanged)) router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [projectId, repoUrl, router, canSync]);

  // Beim Öffnen abgleichen, wenn der Stand älter als 5 Minuten ist, und
  // danach alle 5 Minuten, solange der Tab sichtbar ist.
  useEffect(() => {
    if (!repoUrl || !canSync) return;
    if (!initialCache || Date.now() - Date.parse(initialCache.fetchedAt) > STALE_MS) void sync();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void sync();
    }, STALE_MS);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nur bei neuem Repository neu starten
  }, [repoUrl]);

  async function saveAccess(body: { token?: string | null; issueSync?: boolean }) {
    setAccessBusy(true);
    setAccessError(null);
    try {
      const res = await api<{ access: Access }>(`/api/projects/${projectId}/git`, { method: "PUT", body });
      setAccess(res.access);
      await sync(); // prüft das Token und trägt fehlende Issues nach
    } catch (e) {
      setAccessError(errorMessage(e));
    } finally {
      setAccessBusy(false);
    }
  }

  async function webhookAction(action: WebhookAction) {
    setAccessBusy(true);
    setAccessError(null);
    setWebhookNote(null);
    try {
      const res = await api<{ access: Access; installed?: boolean }>(`/api/projects/${projectId}/git`, { method: "PUT", body: { webhook: action } });
      setAccess(res.access);
      if (res.installed && provider) setWebhookNote(t("webhook.installed", { provider: PROVIDER_LABEL[provider] }));
    } catch (e) {
      setAccessError(errorMessage(e));
    } finally {
      setAccessBusy(false);
    }
  }

  const commits = cache?.commits ?? [];
  const authors = useMemo(() => new Set(commits.map((c) => c.author)).size, [commits]);
  const groups = useMemo(() => {
    const out: Array<{ key: string; commits: CommitInfo[] }> = [];
    for (const c of commits.slice(0, shown)) {
      const key = localDay(new Date(c.date));
      const last = out[out.length - 1];
      if (last?.key === key) last.commits.push(c);
      else out.push({ key, commits: [c] });
    }
    return out;
  }, [commits, shown]);
  const issueBase = cache ? issueBaseOf(cache) : null;

  // Den Token-Zustand kennt nur der Besitzer – alle anderen sehen die Zahl verknüpfter Issues.
  const hasToken = Boolean(access.tokenHint || access.accountToken);
  const issueStat = !canManage ? (linked ? String(linked) : "–") : !hasToken ? t("stats.issuesOff") : !access.issueSync ? t("stats.issuesPaused") : String(linked);
  const issueHint = !canManage
    ? t("stats.linked", { n: linked })
    : !hasToken
      ? t("stats.needToken")
      : !access.issueSync
        ? t("stats.syncOff")
        : t("stats.linked", { n: linked });
  // Gespeicherte Fehler sind Übersetzungsschlüssel (ältere noch deutscher Text).
  const cacheError = cache?.error ? msg(cache.error) : null;

  return (
    <section className="glass p-6 sm:p-8" aria-labelledby="git-heading">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent-ink">
            <GitCommitHorizontal size={20} />
          </span>
          <div className="min-w-0">
            <h2 id="git-heading" className="text-lg font-semibold">{t("panel.title")}</h2>
            {cache?.fullName && cache.webUrl ? (
              <a href={cache.webUrl} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 text-sm text-accent-ink hover:underline">
                <span className="truncate">{cache.fullName}</span> <ExternalLink size={12} className="shrink-0" />
              </a>
            ) : (
              <p className="text-sm text-muted">{repoUrl ? repoUrl.replace(/^https?:\/\//, "") : t("panel.noRepo")}</p>
            )}
            {cache && !cache.error && (
              <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                {provider && <span className="chip !py-0.5">{PROVIDER_LABEL[provider]}</span>}
                {cache.defaultBranch && <span className="chip !py-0.5"><GitBranch size={12} /> {cache.defaultBranch}</span>}
                {cache.stars !== null && <span className="chip !py-0.5"><Star size={12} /> {cache.stars}</span>}
                {cache.ci && <CiBadge ci={cache.ci} />}
              </div>
            )}
          </div>
        </div>
        {repoUrl && (
          <div className="flex items-center gap-2">
            {cache && (
              <span className="hidden text-xs text-muted sm:inline" suppressHydrationWarning>
                {busy ? t("panel.syncing") : t("panel.fetched", { ago: f.ago(cache.fetchedAt) })}
              </span>
            )}
            {canManage && (
              <button type="button" className={cn("btn btn-sm", showAccess && "chip-active")} onClick={() => setShowAccess((s) => !s)} aria-expanded={showAccess}>
                <KeyRound size={14} /> {t("panel.access")}
              </button>
            )}
            {canSync && (
              <button type="button" className="btn btn-sm" onClick={() => void sync()} disabled={busy} aria-label={t("panel.syncNow")}>
                <RefreshCw size={14} className={cn(busy && "animate-spin")} /> <span className="hidden sm:inline">{t("panel.sync")}</span>
              </button>
            )}
          </div>
        )}
      </div>

      {!repoUrl ? (
        <div className="rounded-2xl border border-dashed px-5 py-8 text-center">
          <GitBranch className="mx-auto text-muted" size={26} />
          <p className="mt-2 font-medium">{t("panel.emptyTitle")}</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">
            {richText(t("panel.emptyHint"), { path: <span className="text-fg">{t("panel.emptyPath")}</span> })}
          </p>
        </div>
      ) : (
        <>
          {showAccess && canManage && (
            <AccessPanel
              provider={provider || null}
              access={access}
              busy={accessBusy || busy}
              error={accessError}
              onSave={(b) => void saveAccess(b)}
              webhookNote={webhookNote}
              onWebhook={(a) => void webhookAction(a)}
            />
          )}

          {(error || cacheError) && (
            <p role="alert" className="mb-4 flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-400">
              <TriangleAlert size={16} className="mt-0.5 shrink-0" />
              <span>
                {error ?? cacheError}
                {commits.length > 0 && ` ${t("panel.lastGood")}`}
              </span>
            </p>
          )}
          {issues?.error && !cache?.error && (
            <p role="alert" className="mb-4 flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-400">
              <CircleDot size={16} className="mt-0.5 shrink-0" /> <span>{t("panel.issuesError", { error: msg(issues.error) })}</span>
            </p>
          )}

          {commits.length > 0 && (
            <div className="mb-6 grid gap-3 lg:grid-cols-[1fr_1.4fr]">
              <div className="grid grid-cols-2 gap-3">
                <Stat icon={GitCommitHorizontal} label={t("stats.commits")} value={commits.length >= 100 ? "100+" : String(commits.length)} />
                <Stat icon={RefreshCw} label={t("stats.lastCommit")} value={today ? f.ago(commits[0].date) : "…"} />
                <Stat icon={Users} label={t("stats.contributors")} value={String(authors)} />
                <Stat icon={CircleDot} label={t("stats.issues")} value={issueStat} hint={issueHint} />
              </div>
              {today && <ActivityChart commits={commits} today={today} />}
            </div>
          )}

          {cache?.ci && cache.ci.runs.length > 0 && <CiRuns ci={cache.ci} />}

          {!cache && busy && (
            <div className="space-y-3" aria-hidden>
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex animate-pulse gap-3">
                  <span className="h-8 w-8 rounded-full bg-fg/10" />
                  <span className="h-8 flex-1 rounded-lg bg-fg/10" />
                </div>
              ))}
            </div>
          )}

          {cache && !cache.error && commits.length === 0 && <p className="text-sm text-muted">{t("panel.noCommits")}</p>}

          {today && groups.length > 0 && (
            <div className="space-y-5">
              {groups.map((g) => (
                <div key={g.key}>
                  <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted">
                    {dayLabel(g.key, today, t, locale)}
                    <span className="h-px flex-1 bg-fg/10" />
                    <span className="font-normal normal-case tabular-nums">{g.commits.length}</span>
                  </h3>
                  <ol>
                    {g.commits.map((c, i) => (
                      <CommitRow key={c.sha} commit={c} issueBase={issueBase} last={i === g.commits.length - 1} />
                    ))}
                  </ol>
                </div>
              ))}
              {commits.length > shown && (
                <button type="button" className="btn btn-sm w-full" onClick={() => setShown((n) => n + PAGE)}>
                  {t("panel.moreCommits", { n: commits.length - shown })}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
