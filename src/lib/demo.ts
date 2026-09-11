import type { Prisma, ProjectStatus, TaskStatus } from "@prisma/client";
import { db } from "./db";
import { hashPassword } from "./auth/password";
import { randomToken } from "./crypto";
import { dayKey, slugify } from "./utils";
import { dayKeyToDate } from "./taskDates";
import { STARTER_PROMPTS } from "./prompts";
import { syncProjectRepository } from "./git/sync";
import type { Cause } from "./grave";
import { DEMO_USERNAME, demoMayReset, lastResetMark } from "./demoGuard";

// Demo-Instanz (DEMO_MODE=true): Beispieldaten beim ersten Start und jede
// Nacht um 3 Uhr (Europe/Berlin) neu. Gelöscht wird nur, solange die Instanz
// ausschließlich das Demo-Konto kennt – siehe demoMayReset(). Die Commits von
// VibeWorks selbst sind echt: einmal je Reset von GitHub geholt.

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const CHECK_MS = 5 * 60_000;

const ago = (days: number, hours = 0) => new Date(Date.now() - days * DAY - hours * HOUR);
const dueIn = (days: number) => dayKeyToDate(dayKey(new Date(Date.now() + days * DAY)));

interface SeedTask {
  title: string;
  status: TaskStatus;
  due?: number;
  labels?: string[];
  description?: string;
  doneDaysAgo?: number;
  today?: boolean;
}
interface SeedProject {
  name: string;
  summary: string;
  description?: string;
  status: ProjectStatus;
  priority?: number;
  progress?: number;
  accent: string;
  tags: string[];
  favorite?: boolean;
  progressFromTasks?: boolean;
  repoUrl?: string;
  liveUrl?: string;
  inPortfolio?: boolean;
  createdDaysAgo: number;
  updatedDaysAgo: number;
  tasks?: SeedTask[];
  notes?: Array<{ title: string; content: string; pinned?: boolean }>;
  costs?: Array<{ name: string; amountCents: number; interval: "MONTHLY" | "YEARLY" | "ONCE"; renewsInDays?: number; note?: string }>;
  grave?: { daysAgo: number; epitaph: string; cause: Cause; before: ProjectStatus };
  /** Titel für den Verlauf (Heatmap) */
  work: string[];
}

const PROJECTS: SeedProject[] = [
  {
    name: "VibeWorks",
    summary: "Die Zentrale für Vibe-Coding-Projekte – dieses Projekt hier",
    description:
      "Selbst gehostete Zentrale für alle Vibe-Coding-Projekte: Aufgaben, Notizen, Commits, CI und Claude Code an einem Ort.\n\n## Stand\n- Web-App, Windows-App und MCP-Server laufen\n- Webseite und Doku sind online\n\n## Als Nächstes\n- Öffentliche Live-Demo\n- Code-Signatur für die Windows-App",
    status: "IN_PROGRESS",
    priority: 3,
    accent: "violet",
    tags: ["next.js", "selbst gehostet"],
    favorite: true,
    progressFromTasks: true,
    repoUrl: "https://github.com/MoinMornhart/vibeworks",
    liveUrl: "https://moinmornhart.github.io/vibeworks/",
    createdDaysAgo: 120,
    updatedDaysAgo: 0,
    tasks: [
      { title: "Landingpage auf GitHub Pages", status: "DONE", doneDaysAgo: 2 },
      { title: "Vorführ-GIF aufnehmen", status: "DONE", doneDaysAgo: 1 },
      { title: "Windows-App mit Auto-Update", status: "DONE", doneDaysAgo: 9 },
      { title: "Öffentliche Live-Demo", status: "DOING", labels: ["web"], today: true },
      { title: "Suche in der Doku", status: "TODO", due: 5 },
      { title: "Übersicht der Tastenkürzel", status: "TODO" },
      { title: "Code-Signatur für die Windows-App", status: "BLOCKED", labels: ["kosten"], description: "Wartet auf ein bezahlbares Zertifikat." },
    ],
    notes: [
      { title: "Release-Checkliste", pinned: true, content: "- [x] Tests grün\n- [x] Changelog-Eintrag\n- [ ] Screenshots aktualisieren\n- [ ] Release-Notiz schreiben" },
      { title: "Ideen für später", content: "- Kalender-Ansicht für fällige Aufgaben\n- Vorlagen mit anderen teilen\n- Statistik je Projekt" },
    ],
    costs: [
      { name: "Domain", amountCents: 1200, interval: "YEARLY", renewsInDays: 45 },
      { name: "Server (VPS)", amountCents: 451, interval: "MONTHLY", renewsInDays: 12 },
      { name: "KI-Abo", amountCents: 2000, interval: "MONTHLY", renewsInDays: 20, note: "Für Claude Code" },
    ],
    work: ["Aufgabenbrett", "MCP-Server", "Windows-App", "Benachrichtigungen", "Heatmap", "Design-Editor", "Installer", "Doku"],
  },
  {
    name: "Wetter-App",
    summary: "Wetter für heute und die nächsten 7 Tage – als PWA",
    status: "IN_PROGRESS",
    progress: 60,
    accent: "cyan",
    tags: ["pwa", "next.js"],
    createdDaysAgo: 45,
    updatedDaysAgo: 1,
    tasks: [
      { title: "Wetterdaten zwischenspeichern", status: "DONE", doneDaysAgo: 6 },
      { title: "Stündliche Vorhersage als Diagramm", status: "DONE", doneDaysAgo: 3 },
      { title: "Standort per GPS abfragen", status: "DOING", today: true },
      { title: "Icons für Regen und Schnee", status: "TODO", due: 0, today: true },
      { title: "Dark Mode für die Einstellungen", status: "TODO", due: 3 },
    ],
    notes: [
      {
        title: "API-Notizen",
        content: "Open-Meteo braucht keinen Schlüssel:\n\n```\nhttps://api.open-meteo.com/v1/forecast?latitude=52.52&longitude=13.41&hourly=temperature_2m\n```",
      },
    ],
    work: ["Vorhersage", "Standort", "Diagramm", "Offline-Modus", "Icons"],
  },
  {
    name: "Rezept-Finder",
    summary: "Rezepte aus dem, was noch im Kühlschrank ist",
    description: "Foto vom Kühlschrank → Zutatenliste → passende Rezepte.\n\n1. Zutaten per Foto erkennen (KI)\n2. Rezepte nach Treffern sortieren\n3. Einkaufsliste für den Rest",
    status: "PLANNING",
    progress: 15,
    accent: "emerald",
    tags: ["ki", "web"],
    createdDaysAgo: 20,
    updatedDaysAgo: 3,
    tasks: [
      { title: "Rezept-APIs vergleichen", status: "TODO", due: -2 },
      { title: "Datenmodell skizzieren", status: "TODO", due: 2 },
      { title: "Einen Namen finden", status: "TODO", labels: ["idee"] },
    ],
    costs: [{ name: "KI-API (Bilderkennung)", amountCents: 500, interval: "MONTHLY", renewsInDays: 8 }],
    work: ["Konzept", "Zutaten-Erkennung", "Rezeptsuche"],
  },
  {
    name: "Budget-Bot",
    summary: "Telegram-Bot, der Ausgaben mitschreibt",
    description: "Nachricht wie „12,50 Döner“ an den Bot – er sortiert es in Kategorien und schickt am Monatsende eine Übersicht.",
    status: "IDEA",
    accent: "amber",
    tags: ["bot"],
    createdDaysAgo: 60,
    updatedDaysAgo: 40,
    work: ["Idee"],
  },
  {
    name: "Portfolio-Seite",
    summary: "Meine Projekte, schön präsentiert",
    status: "DONE",
    progress: 100,
    accent: "blue",
    tags: ["astro"],
    inPortfolio: true,
    createdDaysAgo: 90,
    updatedDaysAgo: 35,
    tasks: [
      { title: "Layout und Farben", status: "DONE", doneDaysAgo: 70 },
      { title: "Projektseiten aus Markdown", status: "DONE", doneDaysAgo: 55 },
      { title: "Veröffentlichen", status: "DONE", doneDaysAgo: 36 },
    ],
    costs: [{ name: "Domain", amountCents: 1500, interval: "YEARLY", renewsInDays: 200 }],
    work: ["Startseite", "Projektseiten", "Kontaktformular", "SEO"],
  },
  {
    name: "Pixel-Spiel",
    summary: "Jump ’n’ Run im Retro-Look",
    status: "ARCHIVED",
    progress: 30,
    accent: "rose",
    tags: ["spiel"],
    createdDaysAgo: 150,
    updatedDaysAgo: 25,
    grave: { daysAgo: 25, epitaph: "Kam nie über Level 1 hinaus – aber Level 1 war großartig.", cause: "motivation", before: "IN_PROGRESS" },
    work: ["Spielfigur", "Level 1", "Sprung-Physik", "Sounds"],
  },
];

/** Kleiner Zufallsgenerator mit festem Startwert – jede Nacht dieselbe Demo. */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const STATUS_LABEL: Record<TaskStatus, string> = { TODO: "Offen", DOING: "In Arbeit", BLOCKED: "Blockiert", DONE: "Erledigt" };

async function seedDemo(): Promise<void> {
  const rnd = seeded(20260913);
  await db.user.deleteMany({});
  await db.webAuthnChallenge.deleteMany({});
  const settings = { mode: "SINGLE" as const, allowRegistration: false, setupDoneAt: new Date() };
  await db.settings.upsert({ where: { id: "instance" }, create: { id: "instance", ...settings }, update: settings });

  const user = await db.user.create({
    data: {
      username: DEMO_USERNAME,
      displayName: "Demo",
      passwordHash: await hashPassword(randomToken(24)), // niemand kennt es – hinein nur über „Demo ansehen“
      role: "USER",
      inboxToken: randomToken(24),
      portfolioPublic: true,
      portfolioBio: "Ich baue kleine Tools für den Alltag – am liebsten mit Claude Code. *Das hier ist ein Demo-Konto.*",
    },
  });

  const positions = new Map<ProjectStatus, number>();
  const created: Array<{ seed: SeedProject; id: string; tasks: Array<{ id: string; seed: SeedTask }> }> = [];
  for (const p of PROJECTS) {
    const position = positions.get(p.status) ?? 0;
    positions.set(p.status, position + 1);
    const project = await db.project.create({
      data: {
        ownerId: user.id,
        name: p.name,
        slug: slugify(p.name),
        summary: p.summary,
        description: p.description ?? null,
        status: p.status,
        priority: p.priority ?? 2,
        progress: p.progress ?? 0,
        accent: p.accent,
        tags: p.tags,
        favorite: p.favorite ?? false,
        progressFromTasks: p.progressFromTasks ?? false,
        repoUrl: p.repoUrl ?? null,
        liveUrl: p.liveUrl ?? null,
        inPortfolio: p.inPortfolio ?? false,
        position,
        createdAt: ago(p.createdDaysAgo),
        updatedAt: ago(p.updatedDaysAgo),
        ...(p.liveUrl ? { liveState: "up", liveSince: ago(30), liveMs: 140, liveCheckedAt: ago(0, 0.05) } : {}),
        ...(p.grave ? { buriedAt: ago(p.grave.daysAgo), epitaph: p.grave.epitaph, causeOfDeath: p.grave.cause, statusBeforeBurial: p.grave.before } : {}),
        notes: {
          create: (p.notes ?? []).map((n, i) => ({ title: n.title, content: n.content, pinned: n.pinned ?? false, createdAt: ago(Math.max(0, p.createdDaysAgo - 5 - i * 7)) })),
        },
        costs: {
          create: (p.costs ?? []).map((c) => ({
            name: c.name,
            amountCents: c.amountCents,
            interval: c.interval,
            renewsOn: c.renewsInDays == null ? null : dayKey(new Date(Date.now() + c.renewsInDays * DAY)),
            note: c.note ?? null,
          })),
        },
      },
    });

    const taskPositions = new Map<TaskStatus, number>();
    const tasks: Array<{ id: string; seed: SeedTask }> = [];
    for (const t of p.tasks ?? []) {
      const tp = taskPositions.get(t.status) ?? 0;
      taskPositions.set(t.status, tp + 1);
      const doneAt = t.status === "DONE" ? ago(t.doneDaysAgo ?? 1) : null;
      const createdAt = ago(Math.min(p.createdDaysAgo, (t.doneDaysAgo ?? 0) + 4));
      const task = await db.task.create({
        data: {
          projectId: project.id,
          title: t.title,
          description: t.description ?? null,
          status: t.status,
          position: tp,
          labels: t.labels ?? [],
          dueDate: t.due == null ? null : dueIn(t.due),
          doneAt,
          statusChangedAt: doneAt ?? (t.status === "TODO" ? createdAt : ago(1)),
          createdAt,
        },
      });
      tasks.push({ id: task.id, seed: t });
    }
    created.push({ seed: p, id: project.id, tasks });
  }

  // Verlauf: Projekte angelegt, dann ein halbes Jahr Arbeit – die letzten 12 Tage ohne Lücke (Serie)
  const activity: Prisma.ActivityCreateManyInput[] = [];
  for (const { seed: p, id } of created) {
    activity.push({ projectId: id, userId: user.id, kind: "PROJECT_CREATED", summary: `Projekt „${p.name}“ angelegt`, meta: { name: p.name }, createdAt: ago(p.createdDaysAgo) });
  }
  for (let d = 0; d < 180; d++) {
    const weekend = [0, 6].includes(ago(d).getDay());
    if (d >= 12 && rnd() > (weekend ? 0.35 : 0.65)) continue;
    const candidates = created.filter(({ seed: p }) => p.createdDaysAgo > d && (!p.grave || d > p.grave.daysAgo) && p.updatedDaysAgo <= d + 1);
    if (!candidates.length) continue;
    const count = 1 + Math.floor(rnd() * 4);
    for (let i = 0; i < count; i++) {
      const { seed: p, id } = candidates[Math.floor(rnd() * candidates.length)];
      const title = p.work[Math.floor(rnd() * p.work.length)];
      const at = ago(d, 1 + rnd() * 9);
      const r = rnd();
      if (r < 0.6) {
        activity.push({ projectId: id, userId: user.id, kind: "TASK_MOVED", summary: `Aufgabe „${title}“: ${STATUS_LABEL.DOING} → ${STATUS_LABEL.DONE}`, meta: { from: "DOING", to: "DONE", title }, createdAt: at });
      } else if (r < 0.85) {
        activity.push({ projectId: id, userId: user.id, kind: "NOTE_UPDATED", summary: `Notiz „${title}“ bearbeitet`, meta: { title }, createdAt: at });
      } else {
        activity.push({ projectId: id, userId: user.id, kind: "TASK_ADDED", summary: `Aufgabe „${title}“ angelegt`, meta: { title }, createdAt: at });
      }
    }
  }
  await db.activity.createMany({ data: activity });

  // Zeiterfassung der letzten zehn Tage und die Heute-Liste
  const tracked = created.flatMap((c) => c.tasks.filter((t) => t.seed.status !== "TODO").map((t) => ({ projectId: c.id, taskId: t.id })));
  const entries: Prisma.TimeEntryCreateManyInput[] = [];
  for (let d = 1; d <= 10; d++) {
    if (rnd() < 0.2) continue;
    for (let i = 0; i < 1 + Math.floor(rnd() * 2); i++) {
      const { projectId, taskId } = tracked[Math.floor(rnd() * tracked.length)];
      const focus = rnd() < 0.3;
      const seconds = focus ? 25 * 60 : 1200 + Math.floor(rnd() * 3600);
      const startedAt = ago(d, 2 + i * 2);
      entries.push({ userId: user.id, projectId, taskId, startedAt, endedAt: new Date(startedAt.getTime() + seconds * 1000), seconds, focusMinutes: focus ? 25 : null });
    }
  }
  await db.timeEntry.createMany({ data: entries });
  const today = dayKey(new Date());
  const focus = created.flatMap((c) => c.tasks.filter((t) => t.seed.today).map((t) => t.id));
  await db.taskFocus.createMany({ data: focus.map((taskId, position) => ({ userId: user.id, taskId, day: today, position })) });

  // Live-Seite: Prüfungen der letzten 30 Tage (danach prüft die Überwachung selbst)
  const live = created.find((c) => c.seed.liveUrl);
  if (live) {
    const checks: Prisma.UptimeCheckCreateManyInput[] = [];
    for (let h = 30 * 24; h > 0; h -= 2) checks.push({ projectId: live.id, at: ago(0, h), ok: true, status: 200, ms: 70 + Math.floor(rnd() * 160) });
    await db.uptimeCheck.createMany({ data: checks });
  }

  await db.prompt.createMany({
    data: STARTER_PROMPTS.de.map((s, i) => ({ userId: user.id, title: s.title, body: s.body, tags: s.tags, uses: [7, 4, 3, 2, 1][i] ?? 0 })),
  });
  await db.inboxItem.createMany({
    data: [
      { userId: user.id, text: "Browser-Erweiterung: offene Tabs als Aufgaben speichern", source: "share", createdAt: ago(0, 3) },
      { userId: user.id, text: "Sprachnotizen per Whisper in den Ideen-Eingang", source: "ntfy", createdAt: ago(1, 5) },
      { userId: user.id, text: "Kalender-Export (ICS) für fällige Aufgaben", source: "manual", createdAt: ago(2) },
    ],
  });
  await db.doc.create({
    data: {
      ownerId: user.id,
      title: "Willkommen in der Demo",
      icon: "👋",
      pinned: true,
      content:
        "Schön, dass du reinschaust! Alles hier ist **Beispiel** und schreibgeschützt – jede Nacht beginnt die Demo von vorn.\n\n## Wo es sich lohnt zu klicken\n- **Dashboard** – alle Projekte, Filter, Kanban\n- **Heute** – Aufgaben aus allen Projekten für den Tag\n- **VibeWorks** (Projekt) – echte Commits, CI, Live-Überwachung und Kosten\n- **Rückblick** – Heatmap, Serien und Erfolge\n- **Prompts** – Vorlagen für Claude Code\n- **Friedhof** – was begraben wurde\n\nSelbst installieren: https://moinmornhart.github.io/vibeworks/",
    },
  });
  await db.doc.create({
    data: {
      ownerId: user.id,
      title: "Deploy-Notizen",
      icon: "🚀",
      position: 1,
      content: "## Wetter-App\n\n```bash\nnpm run build && npx wrangler pages deploy out\n```\n\n## Portfolio\nLäuft auf GitHub Pages, baut bei jedem Push.",
    },
  });

  // Echte Commits und CI von VibeWorks – einmal je Reset, ohne Token (60 Anfragen/Stunde reichen dafür)
  for (const c of created.filter((x) => x.seed.repoUrl)) {
    await syncProjectRepository({ id: c.id, ownerId: user.id, repoUrl: c.seed.repoUrl!, repoTokenCipher: null }).catch((err) => console.warn("[demo] Git:", err));
  }
}

/** Beispieldaten anlegen, wenn nötig: noch keine da oder der letzte Reset (3 Uhr) ist fällig. */
export async function ensureDemo(now = new Date()): Promise<"seeded" | "fresh" | "skipped"> {
  const users = await db.user.findMany({ select: { username: true, createdAt: true } });
  if (!demoMayReset(users.map((u) => u.username))) return "skipped";
  const demo = users.find((u) => u.username === DEMO_USERNAME);
  if (demo && demo.createdAt >= lastResetMark(now)) return "fresh";
  await seedDemo();
  return "seeded";
}

interface DemoState {
  timer?: ReturnType<typeof setInterval>;
  running: boolean;
  warned: boolean;
}
const g = globalThis as typeof globalThis & { __vwDemo?: DemoState };

/** Startet die Demo-Pflege genau einmal je Serverprozess: gleich beim Start, dann alle 5 Minuten. */
export function startDemoScheduler() {
  const state = (g.__vwDemo ??= { running: false, warned: false });
  if (state.timer) return;
  const tick = async () => {
    if (state.running) return;
    state.running = true;
    try {
      const result = await ensureDemo();
      if (result === "seeded") console.log("[demo] Beispieldaten angelegt.");
      if (result === "skipped" && !state.warned) {
        state.warned = true;
        console.warn("[demo] DEMO_MODE ist an, aber es gibt echte Konten – keine Beispieldaten, nur schreibgeschützt.");
      }
    } catch (err) {
      console.error("[demo]", err);
    } finally {
      state.running = false;
    }
  };
  state.timer = setInterval(() => void tick(), CHECK_MS);
  state.timer.unref?.();
  void tick();
}
