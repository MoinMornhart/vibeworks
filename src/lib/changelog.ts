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
    version: "0.1.1",
    date: "2026-09-10",
    title: "Zwei-Faktor-Anmeldung",
    changes: [
      { type: "neu", text: "Einmalcodes (TOTP) mit jeder gängigen Authenticator-App – Einrichtung per QR-Code oder Schlüssel" },
      { type: "neu", text: "Scharf erst nach einem bestätigten Code – wer beim Scannen scheitert, sperrt sich nicht aus" },
      { type: "neu", text: "Zehn Wiederherstellungscodes, nur einmal angezeigt, jeder genau einmal gültig; kopieren oder als Datei sichern" },
      { type: "neu", text: "Anmeldung in zwei Schritten: erst Passwort, dann Code oder Wiederherstellungscode" },
      { type: "neu", text: "Abschalten und neue Codes verlangen das Passwort – eine offene Sitzung allein reicht nicht" },
      { type: "besser", text: "Ein Code gilt nur einmal: abgefangene Codes lassen sich nicht wiederverwenden" },
    ],
  },
  {
    version: "0.1.0",
    date: "2026-09-10",
    title: "Mein Konto",
    changes: [
      { type: "neu", text: "Neue Seite „Mein Konto“: Anzeigename und E-Mail ändern" },
      { type: "neu", text: "Passwort setzen oder wechseln – alle anderen Geräte werden dabei abgemeldet, dieses bleibt angemeldet" },
      { type: "neu", text: "Aktive Sitzungen mit Browser, Betriebssystem, IP und letzter Aktivität; einzeln oder überall sonst abmelden" },
      { type: "besser", text: "Benutzermenü mit direkten Wegen zu Konto und Design" },
    ],
  },
  {
    version: "0.0.9",
    date: "2026-09-10",
    title: "Aufgaben über alle Projekte",
    changes: [
      { type: "neu", text: "Neue Seite „Aufgaben“: jede Aufgabe aus jedem Projekt, nach Fälligkeit geordnet – Überfällig, Heute, Diese Woche, Später, Ohne Termin" },
      { type: "neu", text: "Filter nach Status und Projekt, Erledigtes einblendbar" },
      { type: "neu", text: "Abhaken und Bearbeiten direkt aus der Liste – inklusive nächster Fassung bei wiederkehrenden Aufgaben" },
      { type: "besser", text: "Den heutigen Tag bestimmt der Server in fester Zeitzone (Europe/Berlin) – abends kippt nichts in den falschen Tag" },
    ],
  },
  {
    version: "0.0.8",
    date: "2026-09-10",
    title: "Aufgaben je Projekt",
    changes: [
      { type: "neu", text: "Aufgabenbrett mit Offen · In Arbeit · Blockiert · Erledigt – Ziehen zwischen und innerhalb der Spalten, die Reihenfolge wird gespeichert" },
      { type: "neu", text: "Schnell anlegen per Enter, Details im Dialog: Beschreibung (Markdown), Fälligkeit, Labels, Wiederholung" },
      { type: "neu", text: "Fälligkeiten färben sich: überfällig rot, heute gelb, bald im Akzent" },
      { type: "neu", text: "Wiederkehrende Aufgaben (täglich bis monatlich): beim Erledigen entsteht die nächste Fassung – gerechnet vom Fälligkeitsdatum" },
      { type: "neu", text: "Fortschritt aus Aufgaben: pro Projekt einschaltbar, auf der Karte steht „3/8“" },
      { type: "neu", text: "Spalten zeigen höchstens 15 Karten, der Rest hinter „n weitere anzeigen“" },
      { type: "besser", text: "Projekt-Kanban und Aufgabenbrett teilen sich dieselbe Drag-and-Drop-Grundlage" },
    ],
  },
  {
    version: "0.0.7",
    date: "2026-09-10",
    title: "Notizen mit Markdown",
    changes: [
      { type: "neu", text: "Beliebig viele Notizen je Projekt mit optionalem Titel – Überschriften, Listen, Tabellen, Code und echte Checklisten per Markdown" },
      { type: "neu", text: "Schreiben und Vorschau im Wechsel, Strg+Enter speichert" },
      { type: "neu", text: "Notizen anpinnen – angepinnte stehen oben und sind hervorgehoben" },
      { type: "neu", text: "„bearbeitet vor …“ erscheint nur bei echter Änderung, nicht beim Anpinnen" },
      { type: "besser", text: "Projektbeschreibung wird als Markdown dargestellt" },
      { type: "besser", text: "Rohes HTML, javascript:-Links und fremde Bilder werden beim Darstellen entfernt" },
    ],
  },
  {
    version: "0.0.6",
    date: "2026-09-10",
    title: "Kanban und Mehrfachauswahl",
    changes: [
      { type: "neu", text: "Kanban-Ansicht: Spalten je Status, Karten am Griff ziehen – mit Maus, per Touch nach kurzem Halten oder mit der Tastatur" },
      { type: "neu", text: "Freie Reihenfolge innerhalb einer Spalte wird gespeichert; reines Umsortieren ändert das Änderungsdatum nicht" },
      { type: "neu", text: "Mehrfachauswahl: Status setzen, Tags ergänzen oder entfernen, Favoriten markieren, löschen" },
      { type: "besser", text: "Was der Filter ausblendet, fällt aus der Auswahl – Massenänderungen treffen nur Sichtbares" },
    ],
  },
  {
    version: "0.0.5",
    date: "2026-09-10",
    title: "Projekte und Dashboard",
    changes: [
      { type: "neu", text: "Projekte anlegen, bearbeiten und löschen – ein Name genügt, alles andere lässt sich nachtragen" },
      { type: "neu", text: "Sechs Status von Idee bis Archiviert, direkt auf der Karte umschaltbar; Priorität, Fortschritt, Akzentfarbe, Tags, Favoriten, Repository-Adresse" },
      { type: "neu", text: "Dashboard mit Kennzahlen, Suche, Statusfiltern, fünf Sortierungen und drei Ansichten (Raster, Liste, nach Status)" },
      { type: "neu", text: "Projektseite mit allen Angaben; Ansicht, Sortierung und Archiv-Schalter werden im Browser gemerkt" },
      { type: "neu", text: "Verlauf je Projekt (Anlegen, Statuswechsel, Bearbeitungen) als Grundlage für Rückblick und Zeitleiste" },
    ],
  },
  {
    version: "0.0.4",
    date: "2026-09-10",
    title: "Design-Editor",
    changes: [
      { type: "neu", text: "Eigene Seite „Design“ mit Live-Vorschau – jede Änderung ist sofort sichtbar, gespeichert wird erst auf Knopfdruck" },
      { type: "neu", text: "Sieben Farbschemata, freie Akzentfarbe, komplette Palette für Hell und Dunkel mit Kontrastprüfung, eigene Statusfarben" },
      { type: "neu", text: "Glas-Effekt: Deckkraft und Unschärfe der Karten stufenlos regelbar" },
      { type: "neu", text: "Hintergrund: neun animierte Vorlagen mit Tempo, Intensität und eigenen Farben" },
      { type: "neu", text: "Eigener Farbverlauf (linear, radial, konisch) mit bis zu sechs Farben, Animation und zehn Vorlagen" },
      { type: "neu", text: "Eigene Hintergrundbilder hochladen (PNG, JPEG, WebP, GIF, AVIF) mit Unschärfe, Abdunkelung und Anordnung" },
      { type: "neu", text: "Designs als JSON exportieren und importieren" },
    ],
  },
  {
    version: "0.0.3",
    date: "2026-09-10",
    title: "Proxmox-Installer und Auto-Update",
    changes: [
      { type: "neu", text: "Einzeiler für den Proxmox-Host: legt einen Debian-LXC an und installiert alles (Standard- und Erweitert-Modus)" },
      { type: "neu", text: "update-Befehl im Container mit --status, --check, --rollback, --ref, --auto-on/--auto-off" },
      { type: "neu", text: "Auto-Update alle 15 Minuten: eigener Release je Version, Datenbank-Backup vor der Migration, automatischer Rollback bei fehlgeschlagenem Health-Check" },
      { type: "neu", text: "Installationsanleitung unter docs/INSTALLATION.md" },
    ],
  },
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
