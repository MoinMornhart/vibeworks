"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  CircleDot,
  ExternalLink,
  GitBranch,
  GitCommitHorizontal,
  KeyRound,
  RefreshCw,
  Star,
  TriangleAlert,
  Users,
} from "lucide-react";
import type { RepoCacheView } from "@/lib/git/sync";
import type { IssueSyncResult } from "@/lib/git/issues";
import type { CommitInfo } from "@/lib/git/providers";
import { guessProvider, parseRepoUrl, PROVIDER_LABEL, type GitProvider } from "@/lib/git/parse";
import { api, errorMessage } from "@/lib/client/api";
import { FormError } from "@/components/ui/FormError";
import { cn, timeAgo } from "@/lib/utils";

interface Access {
  tokenHint: string | null;
  issueSync: boolean;
}

const STALE_MS = 5 * 60_000;
const PAGE = 20;
const CHART_DAYS = 30;

const pad = (n: number) => String(n).padStart(2, "0");
const localDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function dayLabel(key: string, today: Date): string {
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (key === localDay(today)) return "Heute";
  if (key === localDay(yesterday)) return "Gestern";
  const d = new Date(`${key}T12:00:00`);
  return d.toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "long", year: d.getFullYear() === today.getFullYear() ? undefined : "numeric" });
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
  const [open, setOpen] = useState(false);
  const time = new Date(commit.date).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  return (
    <li className="relative flex gap-3 pb-4">
      {!last && <span aria-hidden className="absolute left-4 top-9 bottom-0 w-px bg-fg/10" />}
      <Avatar name={commit.author} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <p className="min-w-0 flex-1 break-words text-sm font-medium leading-snug">
            <CommitTitle text={commit.title} issueBase={issueBase} />
          </p>
          {commit.url ? (
            <a
              href={commit.url}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 rounded-md border bg-bg/40 px-1.5 py-px font-mono text-[11px] text-muted transition hover:border-accent/50 hover:text-fg"
              title="Commit öffnen"
            >
              {commit.sha.slice(0, 7)}
            </a>
          ) : (
            <span className="shrink-0 rounded-md border px-1.5 py-px font-mono text-[11px] text-muted">{commit.sha.slice(0, 7)}</span>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
          <span>{commit.author}</span>
          <span aria-hidden>·</span>
          <time dateTime={commit.date} title={new Date(commit.date).toLocaleString("de-DE")}>{time}</time>
          {commit.body && (
            <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="inline-flex items-center gap-0.5 hover:text-fg">
              Details <ChevronDown size={12} className={cn("transition", open && "rotate-180")} />
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
      return { key, count: counts.get(key) ?? 0, label: d.toLocaleDateString("de-DE", { day: "numeric", month: "short" }) };
    });
  }, [commits, today]);
  const max = Math.max(1, ...days.map((d) => d.count));
  const total = days.reduce((s, d) => s + d.count, 0);
  return (
    <figure className="rounded-2xl border bg-bg/25 p-3">
      <figcaption className="mb-2 flex justify-between text-xs text-muted">
        <span>Aktivität · letzte {CHART_DAYS} Tage</span>
        <span className="tabular-nums">{total} Commit{total === 1 ? "" : "s"}</span>
      </figcaption>
      <div className="flex h-14 items-end gap-[3px]" role="img" aria-label={`${total} Commits in den letzten ${CHART_DAYS} Tagen`}>
        {days.map((d) => (
          <div
            key={d.key}
            title={`${d.label}: ${d.count} Commit${d.count === 1 ? "" : "s"}`}
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

const TOKEN_HELP: Record<GitProvider, string> = {
  github: "GitHub: Fine-grained Token nur für dieses Repository – „Contents: Read“ und „Issues: Read and write“.",
  gitlab: "GitLab: Projekt- oder Personal-Access-Token mit dem Scope „api“.",
  gitea: "Gitea/Forgejo: Token mit „repository: read“ und „issue: write“.",
};

function AccessPanel({
  provider,
  access,
  busy,
  error,
  onSave,
}: {
  provider: GitProvider | null;
  access: Access;
  busy: boolean;
  error: string | null;
  onSave: (body: { token?: string | null; issueSync?: boolean }) => void;
}) {
  const [token, setToken] = useState("");
  return (
    <div className="mb-5 space-y-4 rounded-2xl border bg-bg/30 p-4">
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (token.trim()) onSave({ token: token.trim() });
          setToken("");
        }}
      >
        <label className="label" htmlFor="git-token">Zugangstoken</label>
        <div className="flex flex-wrap gap-2">
          <input
            id="git-token"
            type="password"
            autoComplete="off"
            spellCheck={false}
            className="field min-w-0 flex-1 font-mono"
            placeholder={access.tokenHint ? `gespeichert: ${access.tokenHint}` : "Token einfügen …"}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            maxLength={500}
          />
          <button type="submit" className="btn btn-primary btn-sm" disabled={busy || !token.trim()}>Speichern</button>
          {access.tokenHint && (
            <button type="button" className="btn btn-sm" disabled={busy} onClick={() => onSave({ token: null })}>Entfernen</button>
          )}
        </div>
        <p className="text-xs text-muted">
          {(provider && TOKEN_HELP[provider]) ?? Object.values(TOKEN_HELP).join(" ")} Das Token wird verschlüsselt gespeichert und nie wieder angezeigt.
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
          <span className="font-medium">Aufgaben automatisch als Issues anlegen</span>
          <span className="block text-xs text-muted">
            Jede Aufgabe wird zum Issue. Die Labels „in Arbeit“ und „blockiert“ sowie geschlossene Issues sortieren die Aufgabe hier in die passende Spalte – in beide
            Richtungen. Gelöschte Aufgaben schließen ihr Issue als „nicht geplant“.
          </span>
        </span>
      </label>
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
}: {
  projectId: string;
  repoUrl: string | null;
  initialCache: RepoCacheView | null;
  initialAccess: Access;
  linkedIssues: number;
}) {
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
  const [shown, setShown] = useState(PAGE);
  // Datum und Zeitzone erst im Browser – sonst passen Server- und Browserdarstellung nicht zusammen.
  const [today, setToday] = useState<Date | null>(null);
  useEffect(() => setToday(new Date()), []);

  const provider = (cache?.provider || guessProvider(parseRepoUrl(repoUrl)?.host ?? "")) as GitProvider | "" | null;

  const sync = useCallback(async () => {
    if (!repoUrl || busyRef.current) return;
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
  }, [projectId, repoUrl, router]);

  // Beim Öffnen abgleichen, wenn der Stand älter als 5 Minuten ist, und
  // danach alle 5 Minuten, solange der Tab sichtbar ist.
  useEffect(() => {
    if (!repoUrl) return;
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

  const issueStat = !access.tokenHint ? "aus" : !access.issueSync ? "pausiert" : String(linked);
  const issueHint = !access.tokenHint ? "Für Issues ein Zugangstoken hinterlegen" : !access.issueSync ? "Spiegelung ist abgeschaltet" : `${linked} Aufgaben mit Issue`;

  return (
    <section className="glass p-6 sm:p-8" aria-labelledby="git-heading">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent-ink">
            <GitCommitHorizontal size={20} />
          </span>
          <div className="min-w-0">
            <h2 id="git-heading" className="text-lg font-semibold">Git &amp; Updates</h2>
            {cache?.fullName && cache.webUrl ? (
              <a href={cache.webUrl} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 text-sm text-accent-ink hover:underline">
                <span className="truncate">{cache.fullName}</span> <ExternalLink size={12} className="shrink-0" />
              </a>
            ) : (
              <p className="text-sm text-muted">{repoUrl ? repoUrl.replace(/^https?:\/\//, "") : "Kein Repository verknüpft"}</p>
            )}
            {cache && !cache.error && (
              <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                {provider && <span className="chip !py-0.5">{PROVIDER_LABEL[provider]}</span>}
                {cache.defaultBranch && <span className="chip !py-0.5"><GitBranch size={12} /> {cache.defaultBranch}</span>}
                {cache.stars !== null && <span className="chip !py-0.5"><Star size={12} /> {cache.stars}</span>}
              </div>
            )}
          </div>
        </div>
        {repoUrl && (
          <div className="flex items-center gap-2">
            {cache && (
              <span className="hidden text-xs text-muted sm:inline" suppressHydrationWarning>
                {busy ? "gleicht ab …" : `Stand ${timeAgo(cache.fetchedAt)}`}
              </span>
            )}
            <button type="button" className={cn("btn btn-sm", showAccess && "chip-active")} onClick={() => setShowAccess((s) => !s)} aria-expanded={showAccess}>
              <KeyRound size={14} /> Zugang
            </button>
            <button type="button" className="btn btn-sm" onClick={() => void sync()} disabled={busy} aria-label="Jetzt abgleichen">
              <RefreshCw size={14} className={cn(busy && "animate-spin")} /> <span className="hidden sm:inline">Abgleichen</span>
            </button>
          </div>
        )}
      </div>

      {!repoUrl ? (
        <div className="rounded-2xl border border-dashed px-5 py-8 text-center">
          <GitBranch className="mx-auto text-muted" size={26} />
          <p className="mt-2 font-medium">Noch kein Repository</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">
            Unter <span className="text-fg">Bearbeiten → Repository</span> eine Adresse von GitHub, GitLab oder Gitea eintragen – dann erscheinen hier die Commits, und
            Aufgaben können automatisch zu Issues werden.
          </p>
        </div>
      ) : (
        <>
          {showAccess && <AccessPanel provider={provider || null} access={access} busy={accessBusy || busy} error={accessError} onSave={(b) => void saveAccess(b)} />}

          {(error || cache?.error) && (
            <p role="alert" className="mb-4 flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-400">
              <TriangleAlert size={16} className="mt-0.5 shrink-0" />
              <span>
                {error ?? cache?.error}
                {commits.length > 0 && " Angezeigt wird der letzte erfolgreiche Stand."}
              </span>
            </p>
          )}
          {issues?.error && !cache?.error && (
            <p role="alert" className="mb-4 flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-400">
              <CircleDot size={16} className="mt-0.5 shrink-0" /> <span>Issues: {issues.error}</span>
            </p>
          )}

          {commits.length > 0 && (
            <div className="mb-6 grid gap-3 lg:grid-cols-[1fr_1.4fr]">
              <div className="grid grid-cols-2 gap-3">
                <Stat icon={GitCommitHorizontal} label="Commits" value={commits.length >= 100 ? "100+" : String(commits.length)} />
                <Stat icon={RefreshCw} label="Letzter Commit" value={today ? timeAgo(commits[0].date) : "…"} />
                <Stat icon={Users} label="Mitwirkende" value={String(authors)} />
                <Stat icon={CircleDot} label="Issues" value={issueStat} hint={issueHint} />
              </div>
              {today && <ActivityChart commits={commits} today={today} />}
            </div>
          )}

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

          {cache && !cache.error && commits.length === 0 && <p className="text-sm text-muted">Das Repository hat noch keine Commits.</p>}

          {today && groups.length > 0 && (
            <div className="space-y-5">
              {groups.map((g) => (
                <div key={g.key}>
                  <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted">
                    {dayLabel(g.key, today)}
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
                  Weitere Commits ({commits.length - shown})
                </button>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
