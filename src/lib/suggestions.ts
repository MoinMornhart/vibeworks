import type { Prisma, Suggestion } from "@/generated/prisma/client";
import { db } from "./db";
import { visibleTo } from "./access";
import { dayKey } from "./utils";
import { addDaysKey, mondayOf } from "./weeks";
import { dayKeyToDate, diffDays } from "./taskDates";
import { AWAKE_STATUSES, lastSign, SLEEP_DAYS } from "./grave";
import { formatMoney, RENEWAL_WARN_DAYS } from "./costs";
import type { Locale } from "./i18n/config";
import { pickSuggestions, QUIET_WEEKS, WEIGHT, type Candidate, type SuggestionKind } from "./suggestionsLogic";

// Wochen-Vorschläge: Regeln über die eigenen Projekte (Lücken, rote CI,
// Git-Fehler, Verlängerungen, Überfälliges, Schlafendes, große Updates,
// fehlende Planung) – einmal je Woche bis zu fünf, gespeichert, damit
// Annehmen und Ablehnen die Woche über halten.

const DAY = 86_400_000;

const weekOf = (now = new Date()) => mondayOf(dayKey(now));

type Pkg = { name: string; level?: string; current?: string | null; latest?: string | null; advisories?: unknown[] };

async function collect(userId: string, now: Date, locale: Locale): Promise<Candidate[]> {
  const today = dayKey(now);
  const out: Candidate[] = [];
  const projects = await db.project.findMany({
    where: { ownerId: userId, buriedAt: null, status: { not: "ARCHIVED" } },
    select: {
      id: true,
      name: true,
      status: true,
      favorite: true,
      description: true,
      updatedAt: true,
      nudgeSnoozedUntil: true,
      repoCache: { select: { error: true, ci: true, deps: true, commits: true, checkReport: true } },
      // Offene Abhängigkeiten-Aufgaben: dann braucht es dazu keinen Vorschlag mehr
      tasks: { where: { autoKey: { not: null }, status: { not: "DONE" } }, select: { autoKey: true } },
      _count: { select: { tasks: { where: { status: { not: "DONE" } } } } },
      costs: { where: { renewsOn: { not: null } }, select: { id: true, name: true, amountCents: true, currency: true, renewsOn: true, interval: true } },
    },
  });

  for (const p of projects) {
    const cache = p.repoCache;
    const packages = ((cache?.deps as { packages?: Pkg[] } | null)?.packages ?? []);
    const autoTasks = new Set(p.tasks.map((x) => x.autoKey));
    const risky = packages.filter((x) => Array.isArray(x.advisories) && x.advisories.length);
    if (risky.length && !autoTasks.has("deps:vuln")) {
      out.push({ key: `vuln:${p.id}`, kind: "vuln", projectId: p.id, score: WEIGHT.vuln + Math.min(risky.length, 9), data: { project: p.name, packages: risky.slice(0, 4).map((x) => x.name).join(", ") } });
    }
    const check = (cache?.checkReport as { counts?: { secrets?: number; vulnerabilities?: number } } | null)?.counts;
    const secrets = check?.secrets ?? 0;
    const vulns = check?.vulnerabilities ?? 0;
    if (secrets > 0 || vulns > 0) {
      out.push({ key: `check:${p.id}`, kind: "check", projectId: p.id, score: WEIGHT.check + Math.min(secrets, 9), data: { project: p.name, secrets, vulns } });
    }
    const ci = cache?.ci as { state?: string; runs?: Array<{ name: string; state: string }> } | null;
    if (ci?.state === "failure") {
      const runs = (ci.runs ?? []).filter((r) => r.state === "failure").map((r) => r.name).slice(0, 3).join(", ") || "CI";
      out.push({ key: `ci:${p.id}`, kind: "ci", projectId: p.id, score: WEIGHT.ci, data: { project: p.name, runs } });
    }
    if (cache?.error) out.push({ key: `git:${p.id}`, kind: "git", projectId: p.id, score: WEIGHT.git, data: { project: p.name, error: cache.error } });
    const major = packages.filter((x) => x.level === "major" && !(Array.isArray(x.advisories) && x.advisories.length));
    if (major.length && !autoTasks.has("deps:update")) {
      out.push({
        key: `major:${p.id}`,
        kind: "major",
        projectId: p.id,
        score: WEIGHT.major + Math.min(major.length, 9),
        data: { project: p.name, packages: major.slice(0, 4).map((x) => `${x.name} ${x.current ?? "?"} → ${x.latest ?? "?"}`).join(", ") },
      });
    }
    for (const cost of p.costs) {
      if (cost.interval === "ONCE" || !cost.renewsOn) continue;
      const days = diffDays(today, cost.renewsOn);
      if (days < 0 || days > RENEWAL_WARN_DAYS) continue;
      out.push({
        key: `renewal:${cost.id}:${cost.renewsOn}`,
        kind: "renewal",
        projectId: p.id,
        score: WEIGHT.renewal + (RENEWAL_WARN_DAYS - days),
        data: { project: p.name, name: cost.name, date: cost.renewsOn, amount: formatMoney(cost.amountCents, cost.currency, locale) },
      });
    }
    if (AWAKE_STATUSES.includes(p.status)) {
      const days = Math.floor((now.getTime() - lastSign(p.updatedAt, cache?.commits).getTime()) / DAY);
      const snoozed = p.nudgeSnoozedUntil && p.nudgeSnoozedUntil > now;
      if (!p.favorite && !snoozed && days >= SLEEP_DAYS) {
        out.push({ key: `sleeping:${p.id}`, kind: "sleeping", projectId: p.id, score: WEIGHT.sleeping + Math.min(days - SLEEP_DAYS, 9), data: { project: p.name, days } });
      }
      if ((p.status === "IN_PROGRESS" || p.status === "OPEN") && p._count.tasks === 0) {
        out.push({ key: `plan:${p.id}`, kind: "plan", projectId: p.id, score: WEIGHT.plan, data: { project: p.name } });
      }
      if (!p.description?.trim()) out.push({ key: `describe:${p.id}`, kind: "describe", projectId: p.id, score: WEIGHT.describe, data: { project: p.name } });
    }
  }

  const overdue = await db.task.count({
    where: { project: { ...visibleTo(userId), buriedAt: null, status: { not: "ARCHIVED" } }, status: { not: "DONE" }, dueDate: { lt: dayKeyToDate(today) } },
  });
  if (overdue) out.push({ key: "overdue", kind: "overdue", projectId: null, score: WEIGHT.overdue + Math.min(overdue, 9), data: { n: overdue } });
  return out;
}

/** Vorschläge der Woche anlegen, falls es noch keine gibt. Liefert die Zahl neu angelegter. */
export async function ensureWeeklySuggestions(userId: string, now = new Date(), locale: Locale = "de"): Promise<number> {
  const week = weekOf(now);
  if (await db.suggestion.count({ where: { userId, week } })) return 0;
  const quiet = await db.suggestion.findMany({
    where: { userId, week: { gte: addDaysKey(week, -7 * QUIET_WEEKS), lt: week }, status: { not: "OPEN" } },
    select: { key: true },
  });
  const picked = pickSuggestions(await collect(userId, now, locale), quiet.map((q) => q.key));
  if (!picked.length) return 0;
  const { count } = await db.suggestion.createMany({
    data: picked.map((c, position) => ({ userId, week, key: c.key, kind: c.kind, projectId: c.projectId, data: c.data as Prisma.InputJsonValue, position })),
    skipDuplicates: true,
  });
  return count;
}

export function serializeSuggestion(s: Suggestion) {
  return {
    id: s.id,
    kind: s.kind as SuggestionKind,
    projectId: s.projectId,
    data: (s.data ?? {}) as Record<string, string | number>,
    status: s.status as "OPEN" | "ACCEPTED" | "DISMISSED",
    taskId: s.taskId,
  };
}
export type SuggestionItem = ReturnType<typeof serializeSuggestion>;

export async function loadWeekSuggestions(userId: string, now = new Date()): Promise<SuggestionItem[]> {
  const rows = await db.suggestion.findMany({ where: { userId, week: weekOf(now) }, orderBy: { position: "asc" } });
  return rows.map(serializeSuggestion);
}
