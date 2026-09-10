// Änderungsverlauf – einzige Quelle für die Versionsanzeige in der App.
// Neueste Version zuerst. Ein Test stellt sicher, dass der oberste Eintrag
// zur Version in package.json passt.
//
// Versionsschema: Zählwerk mit Übertrag bei 9 (0.0.9 → 0.1.0 → … → 0.9.9 → 1.0.0),
// hochgezählt mit `npm run version:bump`.

export type ChangeType = "neu" | "besser" | "fix";

export interface ChangelogEntry {
  version: string;
  date: string;
  title: string;
  changes: Array<{ type: ChangeType; text: string }>;
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "0.0.2",
    date: "2026-09-10",
    title: "Anmeldung",
    changes: [
      { type: "neu", text: "Einrichtungsassistent für das Administratorkonto mit Einzel- oder Mehrbenutzerbetrieb" },
      { type: "neu", text: "Anmeldung mit Benutzername und Passwort (scrypt), serverseitige Sitzungen" },
      { type: "neu", text: "Selbstregistrierung im Mehrbenutzerbetrieb (abschaltbar)" },
      { type: "neu", text: "Schutz vor Passwortraten: Ratenbegrenzung und 15 Minuten Sperre nach 8 Fehlversuchen" },
      { type: "neu", text: "Navigation, Benutzermenü und Änderungsverlauf hinter der Versionsnummer" },
    ],
  },
  {
    version: "0.0.1",
    date: "2026-09-10",
    title: "Grundgerüst",
    changes: [
      { type: "neu", text: "Projektgerüst mit Next.js 15, Tailwind CSS 4, Prisma und PostgreSQL" },
      { type: "neu", text: "Theme-Engine: animierte Hintergründe, Farbschemata, Hell/Dunkel und Glas-Effekt" },
      { type: "neu", text: "Health-Endpunkt und strikte Sicherheits-Header mit CSP-Nonce" },
    ],
  },
];

export const CURRENT_VERSION = CHANGELOG[0].version;
