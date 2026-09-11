import { z } from "zod";
import type { Locale } from "@/lib/i18n/config";

// Projektvorlagen ohne Datenbank: Form der Daten und die eingebauten
// Vorlagen in beiden Sprachen. Aufgaben starten beim Anlegen immer als „Offen“.

export const templateDataSchema = z.object({
  summary: z.string().max(240).nullish(),
  description: z.string().max(20_000).nullish(),
  accent: z.string().max(20).optional(),
  tags: z.array(z.string().max(32)).max(12).optional(),
  priority: z.number().int().min(1).max(4).optional(),
  progressFromTasks: z.boolean().optional(),
  tasks: z
    .array(z.object({ title: z.string().min(1).max(200), description: z.string().max(20_000).nullish(), labels: z.array(z.string().max(40)).max(8).optional() }))
    .max(500),
  notes: z.array(z.object({ title: z.string().max(200).nullish(), content: z.string().min(1).max(50_000), pinned: z.boolean().optional() })).max(200),
});
export type TemplateData = z.infer<typeof templateDataSchema>;

export interface TemplateView {
  id: string;
  kind: "builtin" | "own";
  name: string;
  description: string | null;
  data: TemplateData;
}

interface BuiltinText {
  name: string;
  description: string;
  summary: string;
  tags: string[];
  tasks: string[];
  notes: Array<{ title: string; content: string }>;
}

export interface Builtin {
  id: string;
  accent: string;
  de: BuiltinText;
  en: BuiltinText;
}

export const BUILTINS: Builtin[] = [
  {
    id: "web",
    accent: "violet",
    de: {
      name: "Web-App",
      description: "Vom ersten Gedanken bis zum Deployment – mit den üblichen Schritten einer Webanwendung.",
      summary: "Eine neue Webanwendung",
      tags: ["web"],
      tasks: [
        "Ziel in einem Satz festhalten",
        "Technik-Stack wählen",
        "Repository anlegen",
        "Grundgerüst aufsetzen",
        "Datenmodell entwerfen",
        "Anmeldung und Konten",
        "Kernfunktion bauen",
        "Design und Handy-Ansicht",
        "Tests für das Wichtigste",
        "Deployment einrichten",
        "README mit Screenshots",
      ],
      notes: [{ title: "Launch-Checkliste", content: "- [ ] Domain und HTTPS\n- [ ] Backups eingerichtet\n- [ ] Fehlerseiten\n- [ ] Datenschutz / Impressum\n- [ ] Erste Nutzer einladen" }],
    },
    en: {
      name: "Web app",
      description: "From the first idea to deployment – with the usual steps of a web application.",
      summary: "A new web application",
      tags: ["web"],
      tasks: [
        "Write down the goal in one sentence",
        "Choose the tech stack",
        "Create the repository",
        "Set up the skeleton",
        "Design the data model",
        "Sign-in and accounts",
        "Build the core feature",
        "Design and mobile view",
        "Tests for what matters",
        "Set up deployment",
        "README with screenshots",
      ],
      notes: [{ title: "Launch checklist", content: "- [ ] Domain and HTTPS\n- [ ] Backups set up\n- [ ] Error pages\n- [ ] Privacy policy / imprint\n- [ ] Invite the first users" }],
    },
  },
  {
    id: "iot",
    accent: "emerald",
    de: {
      name: "Hardware / IoT",
      description: "Elektronik-Projekt mit Mikrocontroller – von der Bauteilliste bis zum Dauertest.",
      summary: "Ein neues Elektronik-Projekt",
      tags: ["iot", "hardware"],
      tasks: [
        "Bauteile auswählen und bestellen",
        "Schaltplan zeichnen",
        "Prototyp auf dem Steckbrett",
        "Firmware: Sensoren auslesen",
        "Daten senden (MQTT/HTTP)",
        "Stromversorgung prüfen",
        "Gehäuse entwerfen und drucken",
        "Dauertest über eine Woche",
      ],
      notes: [
        {
          title: "Einkaufsliste",
          content: "| Bauteil | Anzahl | Preis | Bestellt |\n| --- | --- | --- | --- |\n| Mikrocontroller (z. B. ESP32) | 1 | | ☐ |\n| Sensor | 1 | | ☐ |\n| Netzteil | 1 | | ☐ |",
        },
      ],
    },
    en: {
      name: "Hardware / IoT",
      description: "Electronics project with a microcontroller – from the parts list to the endurance test.",
      summary: "A new electronics project",
      tags: ["iot", "hardware"],
      tasks: [
        "Choose and order parts",
        "Draw the schematic",
        "Breadboard prototype",
        "Firmware: read the sensors",
        "Send data (MQTT/HTTP)",
        "Check the power supply",
        "Design and print the case",
        "Run a one-week endurance test",
      ],
      notes: [
        {
          title: "Shopping list",
          content: "| Part | Qty | Price | Ordered |\n| --- | --- | --- | --- |\n| Microcontroller (e.g. ESP32) | 1 | | ☐ |\n| Sensor | 1 | | ☐ |\n| Power supply | 1 | | ☐ |",
        },
      ],
    },
  },
  {
    id: "bot",
    accent: "cyan",
    de: {
      name: "Bot / Automatisierung",
      description: "Discord-, Telegram- oder Home-Automation-Bot – von den Befehlen bis zum Dauerbetrieb.",
      summary: "Ein neuer Bot",
      tags: ["bot"],
      tasks: [
        "Befehle und Abläufe skizzieren",
        "Bot-Konto und Token anlegen",
        "Grundgerüst mit erstem Befehl",
        "Daten speichern",
        "Fehlerbehandlung und Logs",
        "Dauerbetrieb auf dem Server (systemd/Docker)",
        "Hilfe-Befehl und kurze Doku",
      ],
      notes: [{ title: "Befehle", content: "| Befehl | Was er tut |\n| --- | --- |\n| /hilfe | Zeigt alle Befehle |" }],
    },
    en: {
      name: "Bot / automation",
      description: "Discord, Telegram or home automation bot – from the commands to running it around the clock.",
      summary: "A new bot",
      tags: ["bot"],
      tasks: [
        "Sketch commands and flows",
        "Create the bot account and token",
        "Skeleton with a first command",
        "Store data",
        "Error handling and logs",
        "Run it on the server (systemd/Docker)",
        "Help command and short docs",
      ],
      notes: [{ title: "Commands", content: "| Command | What it does |\n| --- | --- |\n| /help | Shows all commands |" }],
    },
  },
  {
    id: "learn",
    accent: "amber",
    de: {
      name: "Lernprojekt",
      description: "Etwas Neues lernen – mit Ziel, Quellen, Mini-Projekten und Rückblick.",
      summary: "Etwas Neues lernen",
      tags: ["lernen"],
      tasks: [
        "Lernziel festlegen",
        "Gute Quellen sammeln",
        "Grundlagen durcharbeiten",
        "Erstes Mini-Projekt",
        "Notizen zusammenfassen",
        "Etwas Eigenes bauen",
        "Rückblick: Was habe ich gelernt?",
      ],
      notes: [{ title: "Quellen", content: "- Buch / Kurs:\n- Dokumentation:\n- Video:" }],
    },
    en: {
      name: "Learning project",
      description: "Learn something new – with a goal, sources, mini projects and a review.",
      summary: "Learning something new",
      tags: ["learning"],
      tasks: [
        "Set the learning goal",
        "Collect good sources",
        "Work through the basics",
        "First mini project",
        "Summarize your notes",
        "Build something of your own",
        "Review: what did I learn?",
      ],
      notes: [{ title: "Sources", content: "- Book / course:\n- Documentation:\n- Video:" }],
    },
  },
];

export function builtinTemplates(locale: Locale): TemplateView[] {
  return BUILTINS.map((b) => {
    const text = b[locale];
    return {
      id: `builtin:${b.id}`,
      kind: "builtin",
      name: text.name,
      description: text.description,
      data: {
        summary: text.summary,
        description: null,
        accent: b.accent,
        tags: text.tags,
        priority: 2,
        progressFromTasks: true,
        tasks: text.tasks.map((title) => ({ title })),
        notes: text.notes.map((n) => ({ title: n.title, content: n.content, pinned: true })),
      },
    };
  });
}
