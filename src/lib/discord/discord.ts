import type { DiscordLink } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { config } from "@/lib/config";
import { decrypt } from "@/lib/crypto";
import { visibleTo } from "@/lib/access";
import { safeFetch } from "@/lib/security/ssrf";
import { getSettings } from "@/lib/settings";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { makeT, tk, translateMessage } from "@/lib/i18n/messages";
import { dayKeyToDate } from "@/lib/taskDates";
import { dayKey, TIME_ZONE } from "@/lib/utils";
import { readResults, readSteps } from "@/lib/aiWorkflowLogic";
import {
  COMMANDS,
  DISCORD_API,
  noticeEmbed,
  redirectUri,
  reportDue,
  reportEmbed,
  textChannels,
  type ParsedInteraction,
  type ReportData,
} from "./discordLogic";

// Discord-Anbindung (#105): ein Bot je Instanz, den jedes Konto per Klick in
// seinen Server einlädt. Er leitet Benachrichtigungen weiter, schickt einen
// Kurzbericht und beantwortet /vibeworks – nur dem Discord-Konto, das ihn
// eingeladen hat. Fehler landen am Link, nie beim Auslöser.

export class DiscordError extends Error {
  constructor(
    message: string,
    public status = 0,
  ) {
    super(message);
  }
}

/** Für Tests lässt sich die API umleiten (nur mit GIT_ALLOW_LOOPBACK sinnvoll). */
const apiBase = () => process.env.DISCORD_API_BASE || DISCORD_API;

export async function discordConfig() {
  const s = await getSettings();
  const read = (cipher: string | null) => {
    try {
      return cipher ? decrypt(cipher) : null;
    } catch {
      return null;
    }
  };
  const botToken = read(s.discordBotTokenCipher);
  const clientSecret = read(s.discordClientSecretCipher);
  return {
    appId: s.discordAppId,
    publicKey: s.discordPublicKey,
    botToken,
    clientSecret,
    commandsAt: s.discordCommandsAt,
    ready: Boolean(s.discordAppId && s.discordPublicKey && botToken && clientSecret),
  };
}

async function call<T>(method: string, path: string, opts: { body?: unknown; form?: Record<string, string>; bearer?: string; bot?: string | null } = {}): Promise<T> {
  const headers: Record<string, string> = { "User-Agent": "VibeWorks (https://github.com/MoinMornhart/vibeworks, 1)" };
  if (opts.bot) headers.Authorization = `Bot ${opts.bot}`;
  if (opts.bearer) headers.Authorization = `Bearer ${opts.bearer}`;
  let body: string | undefined;
  if (opts.form) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    body = new URLSearchParams(opts.form).toString();
  } else if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }
  let res: Response;
  try {
    res = await safeFetch(`${apiBase()}${path}`, { method, headers, body, timeoutMs: 10_000 });
  } catch {
    throw new DiscordError(tk("discord", "errors.unreachable"));
  }
  const text = await res.text();
  if (!res.ok) {
    let message = "";
    try {
      message = (JSON.parse(text) as { message?: string }).message ?? "";
    } catch {
      /* kein JSON */
    }
    throw new DiscordError(message ? `Discord: ${message} (${res.status})` : `Discord: HTTP ${res.status}`, res.status);
  }
  return (text ? JSON.parse(text) : null) as T;
}

/** Befehle bei Discord anmelden – einmal nach der Einrichtung. */
export async function registerCommands(): Promise<number> {
  const cfg = await discordConfig();
  if (!cfg.ready) throw new DiscordError(tk("discord", "errors.notConfigured"));
  const res = await call<unknown[]>("PUT", `/applications/${cfg.appId}/commands`, { body: COMMANDS, bot: cfg.botToken });
  await db.settings.update({ where: { id: "instance" }, data: { discordCommandsAt: new Date() } });
  return Array.isArray(res) ? res.length : 0;
}

export async function guildChannels(guildId: string): Promise<Array<{ id: string; name: string }>> {
  const cfg = await discordConfig();
  if (!cfg.ready) return [];
  return textChannels(await call<unknown>("GET", `/guilds/${guildId}/channels`, { bot: cfg.botToken }));
}

export async function sendToChannel(channelId: string, payload: { content?: string; embeds?: unknown[] }): Promise<void> {
  const cfg = await discordConfig();
  if (!cfg.ready) throw new DiscordError(tk("discord", "errors.notConfigured"));
  await call("POST", `/channels/${channelId}/messages`, { body: { ...payload, allowed_mentions: { parse: [] } }, bot: cfg.botToken });
}

const localeOf = async (userId: string): Promise<Locale> => {
  const u = await db.user.findUnique({ where: { id: userId }, select: { locale: true } });
  return isLocale(u?.locale) ? u.locale : "de";
};

/** Rückkehr von Discord: Code tauschen, Konto erkennen, Server merken, Begrüßung schicken. */
export async function finishInstall(userId: string, code: string, guildId: string): Promise<DiscordLink> {
  const cfg = await discordConfig();
  if (!cfg.ready) throw new DiscordError(tk("discord", "errors.notConfigured"));
  const token = await call<{ access_token?: string }>("POST", "/oauth2/token", {
    form: { client_id: cfg.appId!, client_secret: cfg.clientSecret!, grant_type: "authorization_code", code, redirect_uri: redirectUri(config.appUrl) },
  });
  if (!token?.access_token) throw new DiscordError(tk("discord", "errors.install"));
  const me = await call<{ id: string; username?: string; global_name?: string | null }>("GET", "/users/@me", { bearer: token.access_token });
  const guild = await call<{ id: string; name?: string; system_channel_id?: string | null }>("GET", `/guilds/${guildId}`, { bot: cfg.botToken });
  const channels = await guildChannels(guildId).catch(() => []);
  const channel = channels.find((c) => c.id === guild.system_channel_id) ?? channels[0] ?? null;
  const data = {
    guildName: guild.name ?? null,
    discordUserId: me.id,
    discordName: me.global_name || me.username || null,
    channelId: channel?.id ?? null,
    channelName: channel?.name ?? null,
    lastError: null,
  };
  const link = await db.discordLink.upsert({ where: { userId_guildId: { userId, guildId } }, create: { userId, guildId, ...data }, update: data });
  if (link.channelId) {
    const t = makeT(await localeOf(userId), "discord");
    await sendToChannel(link.channelId, { content: t("welcome", { url: `${config.appUrl}/account#discord` }) }).catch((err) => recordError(link.id, err));
  }
  return link;
}

async function recordError(linkId: string, err: unknown) {
  const message = err instanceof Error ? err.message : tk("discord", "errors.failed");
  await db.discordLink.update({ where: { id: linkId }, data: { lastError: message.slice(0, 300) } }).catch(() => undefined);
}

/** Link entfernen – und den Server verlassen, wenn ihn sonst niemand mehr nutzt. */
export async function removeLink(userId: string, id: string): Promise<boolean> {
  const link = await db.discordLink.findFirst({ where: { id, userId } });
  if (!link) return false;
  await db.discordLink.delete({ where: { id: link.id } });
  if (!(await db.discordLink.count({ where: { guildId: link.guildId } }))) {
    const cfg = await discordConfig();
    if (cfg.ready) await call("DELETE", `/users/@me/guilds/${link.guildId}`, { bot: cfg.botToken }).catch(() => undefined);
  }
  return true;
}

// ── Bericht ─────────────────────────────────────────────────

const OPEN = (userId: string) => ({ ...visibleTo(userId), buriedAt: null, status: { not: "ARCHIVED" as const } });

async function buildReport(userId: string, period: "day" | "week", locale: Locale, now = new Date()): Promise<ReportData> {
  const t = makeT(locale, "discord");
  const since = new Date(now.getTime() - (period === "week" ? 7 : 1) * 86_400_000);
  const today = dayKeyToDate(dayKey(now));
  const project = OPEN(userId);
  const [counts, overdue, done, doing, projects, errors, runs] = await Promise.all([
    db.task.groupBy({ by: ["status"], where: { project, status: { not: "DONE" } }, _count: true }),
    db.task.count({ where: { project, status: { not: "DONE" }, dueDate: { lt: today } } }),
    db.task.findMany({ where: { project, status: "DONE", doneAt: { gte: since } }, orderBy: { doneAt: "desc" }, take: 30, select: { title: true, project: { select: { name: true } } } }),
    db.task.findMany({ where: { project, status: "DOING" }, orderBy: [{ priority: "desc" }, { updatedAt: "desc" }], take: 15, select: { title: true, assignee: true, project: { select: { name: true } } } }),
    db.project.findMany({ where: project, select: { name: true, liveState: true, repoCache: { select: { error: true, ci: true } } }, take: 300 }),
    db.appError.groupBy({ by: ["projectId"], where: { status: "open", project }, _count: true }),
    db.workflowRun.findMany({ where: { status: "running", project }, orderBy: { updatedAt: "desc" }, take: 10, select: { title: true, steps: true, results: true, project: { select: { name: true } } } }),
  ]);
  const count = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;
  const problems: string[] = [];
  for (const p of projects) {
    if (p.repoCache?.error) problems.push(t("problem.git", { project: p.name, error: translateMessage(locale, p.repoCache.error).slice(0, 80) }));
    if ((p.repoCache?.ci as { state?: string } | null)?.state === "failure") problems.push(t("problem.ci", { project: p.name }));
    if (p.liveState === "down") problems.push(t("problem.down", { project: p.name }));
  }
  if (errors.length) {
    const names = new Map((await db.project.findMany({ where: { id: { in: errors.map((e) => e.projectId) } }, select: { id: true, name: true } })).map((p) => [p.id, p.name]));
    for (const e of errors) problems.push(t("problem.errors", { project: names.get(e.projectId) ?? "?", n: e._count }));
  }
  if (overdue) problems.push(t("problem.overdue", { n: overdue }));
  if (count("BLOCKED")) problems.push(t("problem.blocked", { n: count("BLOCKED") }));
  return {
    period,
    open: { todo: count("TODO"), doing: count("DOING"), blocked: count("BLOCKED"), overdue },
    done: done.map((d) => ({ title: d.title, project: d.project.name })),
    doing: doing.map((d) => ({ title: d.title, project: d.project.name, who: d.assignee })),
    problems,
    workflows: runs.map((r) => ({ title: r.title, project: r.project.name, done: readResults(r.results).length, total: readSteps(r.steps).length })),
    url: `${config.appUrl}/`,
  };
}

export async function reportMessage(userId: string, period: "day" | "week", locale: Locale) {
  const t = makeT(locale, "discord");
  const data = await buildReport(userId, period, locale);
  return {
    embeds: [
      reportEmbed(
        data,
        {
          title: t(period === "week" ? "report.titleWeek" : "report.titleDay"),
          open: t("report.open"),
          done: t(period === "week" ? "report.doneWeek" : "report.doneDay"),
          doing: t("report.doing"),
          problems: t("report.problems"),
          none: t("report.none"),
          workflows: t("report.workflows"),
          footer: t("report.footer"),
        },
        (n) => t("report.more", { n }),
      ),
    ],
  };
}

function zoneParts(at: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, hour: "2-digit", hourCycle: "h23", weekday: "short" }).formatToParts(at);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.find((p) => p.type === "weekday")?.value ?? "");
  return { hour, weekday };
}

/** Fällige Berichte verschicken – vom Benachrichtigungs-Zeitplaner alle zehn Minuten aufgerufen. */
export async function runDiscordReports(now = new Date()): Promise<number> {
  const cfg = await discordConfig();
  if (!cfg.ready) return 0;
  const today = dayKey(now);
  const { hour, weekday } = zoneParts(now);
  const links = await db.discordLink.findMany({ where: { channelId: { not: null }, report: { not: "off" }, user: { active: true } } });
  let sent = 0;
  for (const link of links) {
    if (!reportDue(link.report, link.reportSentOn, today, hour, weekday)) continue;
    await db.discordLink.update({ where: { id: link.id }, data: { reportSentOn: today } });
    try {
      await sendToChannel(link.channelId!, await reportMessage(link.userId, link.report === "weekly" ? "week" : "day", await localeOf(link.userId)));
      sent++;
    } catch (err) {
      await recordError(link.id, err);
    }
  }
  return sent;
}

/** Benachrichtigung in die Discord-Kanäle eines Kontos (Anlässe sind vorher gefiltert). */
export async function deliverDiscord(userId: string, notice: { title: string; message: string; url: string | null; priority?: string }): Promise<void> {
  const links = await db.discordLink.findMany({ where: { userId, forward: true, channelId: { not: null } } });
  if (!links.length || !(await discordConfig()).ready) return;
  const url = notice.url && notice.url.startsWith("/") ? `${config.appUrl}${notice.url}` : notice.url;
  for (const link of links) {
    await sendToChannel(link.channelId!, { embeds: [noticeEmbed({ ...notice, url })] })
      .then(() => (link.lastError ? db.discordLink.update({ where: { id: link.id }, data: { lastError: null } }) : null))
      .catch((err) => recordError(link.id, err));
  }
}

// ── Befehle ─────────────────────────────────────────────────

const EPHEMERAL = 64;
const reply = (data: { content?: string; embeds?: unknown[] }) => ({ type: 4, data: { ...data, flags: EPHEMERAL, allowed_mentions: { parse: [] } } });

export async function handleInteraction(i: ParsedInteraction) {
  if (i.type === 1) return { type: 1 };
  if (i.type !== 2 || i.command !== "vibeworks" || !i.userId) return reply({ content: "?" });
  // Nur wer den Bot eingeladen hat, bekommt Daten – im eigenen Server bevorzugt
  const links = await db.discordLink.findMany({ where: { discordUserId: i.userId, user: { active: true } }, orderBy: { createdAt: "asc" } });
  const link = links.find((l) => l.guildId === i.guildId) ?? links[0];
  if (!link) return reply({ content: makeT(i.locale, "discord")("notLinked", { url: `${config.appUrl}/account#discord` }) });
  const locale = await localeOf(link.userId);
  const t = makeT(locale, "discord");
  switch (i.sub) {
    case "status":
      return reply(await reportMessage(link.userId, "day", locale));
    case "aufgaben": {
      const tasks = await db.task.findMany({
        where: { project: OPEN(link.userId), status: { not: "DONE" } },
        orderBy: [{ priority: "desc" }, { dueDate: { sort: "asc", nulls: "last" } }, { updatedAt: "desc" }],
        take: 10,
        select: { title: true, status: true, dueDate: true, project: { select: { name: true } } },
      });
      const lines = tasks.map((x) => `${x.status === "DOING" ? "🔨" : x.status === "BLOCKED" ? "⛔" : "📋"} ${x.title} · *${x.project.name}*${x.dueDate ? ` · ${dayKey(x.dueDate)}` : ""}`);
      return reply({ embeds: [{ title: t("tasksTitle"), description: (lines.join("\n") || t("report.none")).slice(0, 3500), url: `${config.appUrl}/tasks`, color: 0x8b5cf6 }] });
    }
    case "probleme": {
      const data = await buildReport(link.userId, "day", locale);
      return reply({ embeds: [{ title: t("report.problems"), description: (data.problems.map((p) => `⚠️ ${p}`).join("\n") || `✨ ${t("report.none")}`).slice(0, 3500), color: data.problems.length ? 0xf87171 : 0x34d399 }] });
    }
    case "hier": {
      const own = links.find((l) => l.guildId === i.guildId);
      if (!own || !i.channelId) return reply({ content: t("hereOnlyOwn") });
      await db.discordLink.update({ where: { id: own.id }, data: { channelId: i.channelId, channelName: i.channelName, lastError: null } });
      return reply({ content: t("hereDone", { channel: i.channelName ? `#${i.channelName}` : i.channelId }) });
    }
    default:
      return reply({ content: t("help") });
  }
}
