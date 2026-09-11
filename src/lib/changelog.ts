// Änderungsverlauf – einzige Quelle für die Versionsanzeige in der App.
// Neueste Version zuerst. Ein Test stellt sicher, dass der oberste Eintrag
// zur Version in package.json passt.
//
// Versionsschema: Zählwerk mit Übertrag bei 9 (0.0.9 → 0.1.0 → … → 0.9.9 → 1.0.0),
// hochgezählt mit `npm run version:bump`.
//
// Deutsch ist maßgeblich; titleEn und en sind die englischen Fassungen für
// die Oberfläche auf Englisch. Fehlen sie, zeigt der Dialog Deutsch.

export type ChangeType = "neu" | "besser" | "fix";

export interface ChangelogChange {
  type: ChangeType;
  text: string;
  en?: string;
}

export interface ChangelogEntry {
  version: string;
  date: string;
  title: string;
  titleEn?: string;
  changes: ChangelogChange[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "0.3.8",
    date: "2026-09-11",
    title: "Claude Code direkt anbinden (MCP-Server)",
    titleEn: "Connect Claude Code directly (MCP server)",
    changes: [
      {
        type: "neu",
        text: "VibeWorks ist ein MCP-Server: Claude Code liest Projekte, Aufgaben, Notizen und Docs, legt Aufgaben an und verschiebt sie, schreibt Notizen und Docs – ganz ohne Umweg über GitHub",
        en: "VibeWorks is an MCP server: Claude Code reads projects, tasks, notes and docs, creates and moves tasks, writes notes and docs – no GitHub detour needed",
      },
      {
        type: "neu",
        text: "Mein Konto → Claude Code & API-Schlüssel: Schlüssel erstellen, fertigen Befehl kopieren, jederzeit widerrufen",
        en: "My account → Claude Code & API keys: create a key, copy the finished command, revoke it at any time",
      },
      {
        type: "besser",
        text: "Aufgaben und Notizen entstehen in der Oberfläche und über Claude auf demselben Weg – Verlauf, Fortschritt und Issues verhalten sich gleich",
        en: "Tasks and notes are created the same way in the app and through Claude – activity log, progress and issues behave identically",
      },
    ],
  },
  {
    version: "0.3.7",
    date: "2026-09-11",
    title: "Neuer Fahrplan: Stufe 4",
    titleEn: "New roadmap: stage 4",
    changes: [
      {
        type: "besser",
        text: "README: Fahrplan um Stufe 4 (MCP-Server, Live-Überwachung, Projekt-Friedhof, Heatmap, Kosten, Prompt-Bibliothek …) und die Webseite erweitert",
        en: "README: roadmap extended with stage 4 (MCP server, live monitoring, project graveyard, heatmap, costs, prompt library …) and the website",
      },
    ],
  },
  {
    version: "0.3.6",
    date: "2026-09-11",
    title: "Benachrichtigungen per ntfy, Webhook und E-Mail",
    titleEn: "Notifications via ntfy, webhook and email",
    changes: [
      {
        type: "neu",
        text: "Mein Konto → Benachrichtigungen: Push aufs Handy mit ntfy (auch eigener Server), Webhook (Discord, Slack oder JSON) und E-Mail – mit Test-Knopf",
        en: "My account → Notifications: push to your phone with ntfy (your own server works too), webhook (Discord, Slack or JSON) and email – with a test button",
      },
      {
        type: "neu",
        text: "Anlässe: fällige Aufgaben jeden Morgen um 8 Uhr, Zugriffsanfragen, per Git erledigte Aufgaben, fehlgeschlagene CI und – für Admins – installierte Updates",
        en: "Triggers: due tasks every morning at 8 am, access requests, tasks completed via Git, failed CI and – for admins – installed updates",
      },
      {
        type: "neu",
        text: "Admin → E-Mail-Versand: SMTP-Server eintragen und Test-Mail senden",
        en: "Admin → Email sending: configure the SMTP server and send a test email",
      },
    ],
  },
  {
    version: "0.3.5",
    date: "2026-09-11",
    title: "Wochenrückblick und Zeitleiste",
    titleEn: "Weekly review and timeline",
    changes: [
      {
        type: "neu",
        text: "Wochenrückblick (Navigation → Rückblick): Kennzahlen der Woche, Erledigtes je Projekt, als Nächstes Fälliges, aktivste Projekte – mit Blättern zwischen den Wochen",
        en: "Weekly review (navigation → Review): the week in numbers, completed tasks per project, what's due next, most active projects – with paging between weeks",
      },
      {
        type: "neu",
        text: "Zeitleiste über alle Projekte: Aufgaben, Notizen, Statuswechsel und Commits nach Tagen, nach Projekt filterbar",
        en: "Timeline across all projects: tasks, notes, status changes and commits by day, filterable by project",
      },
      {
        type: "besser",
        text: "Verlaufseinträge erscheinen in der gewählten Sprache; der Verlauf je Projekt reicht jetzt 1000 statt 200 Einträge zurück",
        en: "History entries appear in the chosen language; each project's history now goes back 1000 instead of 200 entries",
      },
    ],
  },
  {
    version: "0.3.4",
    date: "2026-09-11",
    title: "Projektvorlagen, Export und Import",
    titleEn: "Project templates, export and import",
    changes: [
      {
        type: "neu",
        text: "Beim Anlegen eines Projekts eine Vorlage wählen: Web-App, Hardware/IoT, Bot/Automatisierung, Lernprojekt – jeweils mit passenden Aufgaben und einer Notiz",
        en: "Pick a template when creating a project: web app, hardware/IoT, bot/automation, learning project – each with matching tasks and a note",
      },
      {
        type: "neu",
        text: "Eigene Vorlagen: jedes Projekt über „…“ → „Als Vorlage speichern“ – samt Aufgaben und Notizen",
        en: "Your own templates: save any project via “…” → “Save as template” – including tasks and notes",
      },
      {
        type: "neu",
        text: "Export als JSON: ein Projekt über „…“ im Projektkopf oder alles unter „Mein Konto → Daten“ – ohne Tokens und Geheimnisse",
        en: "Export as JSON: a single project via “…” in the project header or everything under “My account → Data” – without tokens or secrets",
      },
      {
        type: "neu",
        text: "Import unter „Mein Konto → Daten“: Projekte, Aufgaben, Notizen und Docs kommen neu dazu, nichts wird überschrieben",
        en: "Import under “My account → Data”: projects, tasks, notes and docs are added as new, nothing gets overwritten",
      },
    ],
  },
  {
    version: "0.3.3",
    date: "2026-09-11",
    title: "CI-Status und Webhooks",
    titleEn: "CI status and webhooks",
    changes: [
      {
        type: "neu",
        text: "CI-Status: GitHub Actions, GitLab-Pipelines und Gitea-Status des Hauptzweigs – als Abzeichen im Git-Bereich, mit Liste der letzten Läufe und als Punkt auf der Projektkarte",
        en: "CI status: GitHub Actions, GitLab pipelines and Gitea statuses of the main branch – as a badge in the Git section, with a list of recent runs and as a dot on the project card",
      },
      {
        type: "neu",
        text: "Webhooks: GitHub, GitLab und Gitea melden Commits, Issues und CI-Läufe sofort – Einrichtung unter Git & Updates → Zugang, mit Knopf zum automatischen Eintragen",
        en: "Webhooks: GitHub, GitLab and Gitea report commits, issues and CI runs instantly – set up under Git & updates → Access, with a button to add it automatically",
      },
      {
        type: "besser",
        text: "Der GitHub-Token-Link enthält jetzt auch das Recht „admin:repo_hook“, damit Webhooks automatisch eingetragen werden können",
        en: "The GitHub token link now also includes the “admin:repo_hook” scope so webhooks can be added automatically",
      },
    ],
  },
  {
    version: "0.3.2",
    date: "2026-09-11",
    title: "VibeWorks auf Englisch",
    titleEn: "VibeWorks in English",
    changes: [
      {
        type: "neu",
        text: "Die ganze Oberfläche gibt es jetzt auch auf Englisch – umschaltbar unter „Mein Konto“, im Benutzermenü und auf der Anmeldeseite; die Wahl gilt auf allen Geräten",
        en: "The whole interface is now available in English – switch it under “My account”, in the user menu or on the sign-in page; your choice applies on all devices",
      },
      {
        type: "neu",
        text: "Ohne Anmeldung richtet sich die Sprache nach dem Browser",
        en: "Before signing in, the language follows your browser",
      },
      {
        type: "besser",
        text: "Fehlermeldungen, Datumsangaben („vor 3 Minuten“ / „3 minutes ago“), Status, Changelog und die öffentliche Projektseite erscheinen in der gewählten Sprache",
        en: "Error messages, dates (“3 minutes ago”), statuses, the changelog and the public project page appear in the chosen language",
      },
      {
        type: "neu",
        text: "README und Installationsanleitung auf GitHub auch auf Englisch, mit englischen Screenshots",
        en: "README and installation guide on GitHub are also available in English, with English screenshots",
      },
    ],
  },
  {
    version: "0.3.1",
    date: "2026-09-11",
    title: "Schlichtere Sortierauswahl",
    titleEn: "Simpler sort picker",
    changes: [
      {
        type: "besser",
        text: "Dashboard: Die Sortierung heißt wieder einfach „Priorität“ – ohne Stern in der Beschriftung",
        en: "Dashboard: The sort option is simply called “Priority” again – no star in the label",
      },
    ],
  },
  {
    version: "0.3.0",
    date: "2026-09-11",
    title: "Favoriten nur bei Priorität vorne",
    titleEn: "Favorites first only when sorting by priority",
    changes: [
      {
        type: "besser",
        text: "Dashboard: Projekte mit ★ stehen nur noch bei der Sortierung „Priorität“ oben – bei Zuletzt geändert, Erstellt, Name, Fortschritt und Status zählt allein das jeweilige Kriterium",
        en: "Dashboard: Projects with ★ only move to the top when sorting by “Priority” – for last modified, created, name, progress and status, only that criterion counts",
      },
      {
        type: "besser",
        text: "Sortierung „Priorität (★ zuerst)“: Favoriten, dann Kritisch bis Niedrig, bei Gleichstand das zuletzt Geänderte zuerst",
        en: "“Priority (★ first)” sort: favorites, then critical down to low, with the most recently modified first on ties",
      },
    ],
  },
  {
    version: "0.2.9",
    date: "2026-09-11",
    title: "Übersichtlicher Fahrplan",
    titleEn: "Clearer roadmap",
    changes: [
      {
        type: "besser",
        text: "README: Fahrplan als klare Liste mit ✅ (fertig) und ⏳ (kommt noch) – nichts mehr durchgestrichen",
        en: "README: Roadmap as a clear list with ✅ (done) and ⏳ (coming up) – nothing crossed out anymore",
      },
    ],
  },
  {
    version: "0.2.8",
    date: "2026-09-10",
    title: "Git-Abgleich im Hintergrund",
    titleEn: "Background Git sync",
    changes: [
      {
        type: "neu",
        text: "Der Server gleicht alle 5 Minuten selbst Commits und Issues ab – Aufgaben wandern nach „In Arbeit“ oder „Erledigt“, auch wenn niemand VibeWorks offen hat",
        en: "The server now syncs commits and issues on its own every 5 minutes – tasks move to “In progress” or “Done” even when nobody has VibeWorks open",
      },
      {
        type: "besser",
        text: "Gilt für alle Projekte mit Token oder Git-Verbindung; Takt über GIT_SYNC_INTERVAL_MIN einstellbar, mit GIT_SYNC_DISABLED=true abschaltbar",
        en: "Applies to all projects with a token or Git connection; set the interval with GIT_SYNC_INTERVAL_MIN, turn it off with GIT_SYNC_DISABLED=true",
      },
    ],
  },
  {
    version: "0.2.7",
    date: "2026-09-10",
    title: "Git-Verbindungen fürs ganze Konto",
    titleEn: "Account-wide Git connections",
    changes: [
      {
        type: "neu",
        text: "Mein Konto → Git-Verbindungen: einmal verbinden, für alle Projekte – Commits auch aus privaten Repositories, Aufgaben automatisch als Issues",
        en: "My account → Git connections: connect once, use it for every project – commits from private repositories too, tasks automatically become issues",
      },
      {
        type: "neu",
        text: "GitHub, GitLab und Gitea/Forgejo – auch selbst gehostet, im Heimnetz und auf eigenem Port; mehrere Verbindungen gleichzeitig möglich",
        en: "GitHub, GitLab and Gitea/Forgejo – self-hosted too, on your home network and on a custom port; multiple connections at once",
      },
      {
        type: "neu",
        text: "Anleitung je Anbieter mit Link zur passenden Token-Seite; das Token wird beim Speichern geprüft und zeigt, als wer du verbunden bist",
        en: "Step-by-step guide per provider with a link to the right token page; the token is verified on save and shows who you're connected as",
      },
      {
        type: "besser",
        text: "Projekte ohne eigenes Token nutzen automatisch die Verbindung zu ihrem Server – im Git-Bereich steht dann „Konto-Token aktiv“",
        en: "Projects without their own token automatically use the connection to their server – the Git section then shows “Account token active”",
      },
      {
        type: "neu",
        text: "Schon bei der Registrierung und der Ersteinrichtung lässt sich Git optional verbinden – mit kurzer Erklärung",
        en: "Git can optionally be connected right during sign-up and initial setup – with a short explanation",
      },
    ],
  },
  {
    version: "0.2.6",
    date: "2026-09-10",
    title: "Projekte teilen",
    titleEn: "Project sharing",
    changes: [
      {
        type: "neu",
        text: "Projekte teilen: öffentlicher Link, der auch ohne Konto funktioniert – Beschreibung, Aufgaben und Commits zum Lesen, Notizen bleiben privat",
        en: "Share projects: a public link that works without an account – description, tasks and commits are read-only, notes stay private",
      },
      {
        type: "neu",
        text: "Angemeldete Besucher eines Links können Zugriff anfragen (Ansehen oder Bearbeiten, mit Nachricht)",
        en: "Signed-in visitors of a link can request access (view or edit, with a message)",
      },
      {
        type: "neu",
        text: "Teilen-Dialog für Besitzer: Link erstellen, erneuern oder abschalten, Anfragen annehmen oder ablehnen, Mitglieder per Benutzername hinzufügen, Rollen ändern und entfernen",
        en: "Share dialog for owners: create, renew or disable the link, accept or decline requests, add members by username, change roles and remove members",
      },
      {
        type: "neu",
        text: "Rollen: Betrachter lesen nur, Bearbeiter ändern Aufgaben, Notizen, Status und Beschreibung – Repository, Token, Teilen und Löschen bleiben beim Besitzer",
        en: "Roles: viewers can only read, editors can change tasks, notes, status and description – repository, token, sharing and deletion stay with the owner",
      },
      {
        type: "neu",
        text: "Dashboard: Bereich „Mit mir geteilt“ und Hinweis auf offene Zugriffsanfragen",
        en: "Dashboard: “Shared with me” section and a notice about pending access requests",
      },
      {
        type: "neu",
        text: "Knopf „Token auf GitHub erstellen“ im Zugang-Feld – öffnet GitHub mit allem vorausgefüllt",
        en: "“Create token on GitHub” button in the access field – opens GitHub with everything prefilled",
      },
    ],
  },
  {
    version: "0.2.5",
    date: "2026-09-10",
    title: "Neue Projektseite auf GitHub",
    titleEn: "New project page on GitHub",
    changes: [
      {
        type: "besser",
        text: "README neu gestaltet: Banner, Abzeichen, Funktionsübersicht, Screenshots und Anleitung für Aufgaben ↔ Issues mit Claude Code",
        en: "Redesigned README: banner, badges, feature overview, screenshots and a guide for tasks ↔ issues with Claude Code",
      },
      {
        type: "besser",
        text: "Repository mit Beschreibung und Themen, damit es sich auf GitHub leichter finden lässt",
        en: "Repository description and topics so it's easier to find on GitHub",
      },
    ],
  },
  {
    version: "0.2.4",
    date: "2026-09-10",
    title: "Git & Updates, Aufgaben als Issues",
    titleEn: "Git & updates, tasks as issues",
    changes: [
      {
        type: "neu",
        text: "Projektseite: neuer Bereich „Git & Updates“ unter den Notizen – Commits aus GitHub, GitLab oder Gitea als Zeitleiste nach Tagen, mit Aktivitätsdiagramm, Mitwirkenden, Versions-Plaketten und verlinkten Issue-Nummern",
        en: "Project page: new “Git & updates” section below the notes – commits from GitHub, GitLab or Gitea as a timeline by day, with an activity chart, contributors, version badges and linked issue numbers",
      },
      {
        type: "neu",
        text: "Commits gleichen sich beim Öffnen und alle 5 Minuten selbst ab; der letzte Stand bleibt bei Fehlern erhalten",
        en: "Commits sync on open and every 5 minutes; the last known state is kept if something goes wrong",
      },
      {
        type: "neu",
        text: "Zugangstoken pro Projekt (verschlüsselt gespeichert) – für private Repositories und die Issue-Spiegelung",
        en: "Access token per project (stored encrypted) – for private repositories and issue mirroring",
      },
      {
        type: "neu",
        text: "Aufgaben werden automatisch zu Issues: Titel, Text, Fälligkeit und Status wandern mit, gelöschte Aufgaben schließen ihr Issue als „nicht geplant“",
        en: "Tasks automatically become issues: title, text, due date and status carry over, deleted tasks close their issue as “not planned”",
      },
      {
        type: "neu",
        text: "Issues sortieren sich in die Spalten: Label „in Arbeit“ → In Arbeit, „blockiert“ → Blockiert, geschlossen → Erledigt – in beide Richtungen",
        en: "Issues sort themselves into columns: label “in progress” → In progress, “blocked” → Blocked, closed → Done – in both directions",
      },
      {
        type: "neu",
        text: "Erledigte und blockierte Aufgaben verschwinden nach 2 Tagen vom Board und lassen sich per Klick wieder einblenden",
        en: "Done and blocked tasks disappear from the board after 2 days and can be shown again with a click",
      },
      {
        type: "besser",
        text: "Dashboard und Projektseite holen Änderungen selbst nach – beim Zurückkehren zum Tab und jede Minute",
        en: "Dashboard and project page pick up changes on their own – when you return to the tab and every minute",
      },
      {
        type: "fix",
        text: "Sortierung „Status (Idee → Fertig)“: Favoriten stehen nur noch innerhalb ihres Status oben, statt die Reihenfolge zu durchbrechen",
        en: "“Status (idea → done)” sort: favorites now only go to the top within their status instead of breaking the order",
      },
      {
        type: "besser",
        text: "Schutz vor Server-Side Request Forgery für alle Abrufe von Repository-Adressen",
        en: "Protection against server-side request forgery for all repository URL requests",
      },
    ],
  },
  {
    version: "0.2.3",
    date: "2026-09-10",
    title: "Sortieren nach Status",
    titleEn: "Sort by status",
    changes: [
      {
        type: "neu",
        text: "Dashboard: neue Sortierung „Status (Idee → Fertig)“ – Idee, In Planung, Offen, In Entwicklung, Fertig, Archiviert",
        en: "Dashboard: new “Status (idea → done)” sort – Idea, Planning, Open, In development, Done, Archived",
      },
      {
        type: "besser",
        text: "Aufgeklappte Auswahllisten zeigen die Farben des eigenen Designs statt des grauen Standards",
        en: "Open dropdown lists use the colors of your own design instead of the default gray",
      },
    ],
  },
  {
    version: "0.2.2",
    date: "2026-09-10",
    title: "Mini-Docs",
    titleEn: "Mini docs",
    changes: [
      {
        type: "neu",
        text: "Neuer Reiter „Docs“: eigene Seiten mit beliebig tiefen Unterseiten im Seitenbaum",
        en: "New “Docs” tab: your own pages with subpages nested as deep as you like in a page tree",
      },
      {
        type: "neu",
        text: "Markdown-Editor mit Schreiben, Geteilt und Vorschau, Werkzeugleiste (fett, kursiv, Überschrift, Listen, Checklisten, Zitat, Code, Link) und Emoji-Symbol je Seite",
        en: "Markdown editor with write, split and preview modes, a toolbar (bold, italic, heading, lists, checklists, quote, code, link) and an emoji icon per page",
      },
      {
        type: "neu",
        text: "Speichert automatisch beim Tippen, Strg+S sofort; Brotkrumen, Unterseiten-Übersicht und „Zuletzt bearbeitet“",
        en: "Saves automatically as you type, Ctrl+S saves instantly; breadcrumbs, subpage overview and “Recently edited”",
      },
      {
        type: "neu",
        text: "Seiten verschieben, nach oben/unten sortieren und samt Unterseiten löschen – Kreise im Baum sind ausgeschlossen",
        en: "Move pages, reorder them up/down and delete them along with their subpages – cycles in the tree are prevented",
      },
      {
        type: "neu",
        text: "Docs sind in der Volltextsuche und in der Schnellsuche (Strg+K) enthalten",
        en: "Docs are included in full-text search and in quick search (Ctrl+K)",
      },
    ],
  },
  {
    version: "0.2.1",
    date: "2026-09-10",
    title: "„update“ auf dem Proxmox-Host",
    titleEn: "“update” on the Proxmox host",
    changes: [
      {
        type: "neu",
        text: "Auf dem Proxmox-Host gibt es jetzt den Befehl „update“: allein holt er das neueste Update, Optionen wie --status werden durchgereicht",
        en: "The Proxmox host now has an “update” command: on its own it fetches the latest update, options like --status are passed through",
      },
      {
        type: "besser",
        text: "Fehlt im Container der update-Befehl (unvollständige Installation), repariert „update“ bzw. „vibeworks …“ die Installation automatisch",
        en: "If the update command is missing in the container (incomplete installation), “update” or “vibeworks …” repairs the installation automatically",
      },
    ],
  },
  {
    version: "0.2.0",
    date: "2026-09-10",
    title: "Dialoge auf dem Handy oben",
    titleEn: "Dialogs at the top on phones",
    changes: [
      {
        type: "besser",
        text: "Dialoge – z. B. die Schnellerfassung über den Blitz – öffnen auf dem Handy im oberen Bereich statt ganz unten, die Tastatur verdeckt nichts mehr",
        en: "Dialogs – e.g. quick capture via the lightning bolt – open near the top on phones instead of at the very bottom, so the keyboard no longer covers anything",
      },
    ],
  },
  {
    version: "0.1.9",
    date: "2026-09-10",
    title: "Befehle direkt auf dem Proxmox-Host",
    titleEn: "Commands right on the Proxmox host",
    changes: [
      {
        type: "neu",
        text: "Befehl „vibeworks“ auf dem Proxmox-Host: status, check, update, rollback, auto on/off, domain, url, logs, shell – ohne erst in den Container zu wechseln",
        en: "“vibeworks” command on the Proxmox host: status, check, update, rollback, auto on/off, domain, url, logs, shell – without entering the container first",
      },
      {
        type: "neu",
        text: "„vibeworks repair“ repariert eine unvollständige Installation im Container, Daten und .env bleiben erhalten",
        en: "“vibeworks repair” fixes an incomplete installation in the container, keeping data and .env",
      },
      {
        type: "neu",
        text: "Adresse ändern mit „vibeworks domain …“ bzw. im Container „update --domain …“ – inklusive Neustart und Hinweisen zu Proxy und Passkeys",
        en: "Change the address with “vibeworks domain …” or, inside the container, “update --domain …” – including a restart and tips on proxies and passkeys",
      },
      {
        type: "besser",
        text: "Der Proxmox-Installer richtet den Host-Befehl automatisch ein und findet den Container später selbst wieder",
        en: "The Proxmox installer sets up the host command automatically and finds the container again later on its own",
      },
    ],
  },
  {
    version: "0.1.8",
    date: "2026-09-10",
    title: "Update per Knopfdruck",
    titleEn: "One-click updates",
    changes: [
      {
        type: "neu",
        text: "Admin-Bereich „Updates“: nach Updates suchen – mit Liste der neuen Änderungen – und das neueste Update per Knopf installieren",
        en: "Admin “Updates” section: check for updates – with a list of what's new – and install the latest update with one click",
      },
      {
        type: "neu",
        text: "Fortschritt und Log live im Browser, nach dem Neustart lädt die Seite von selbst mit der neuen Version",
        en: "Live progress and log in the browser; after the restart the page reloads on its own with the new version",
      },
      {
        type: "besser",
        text: "Die App bekommt dafür keine Root-Rechte: ein systemd-Wächter führt nur „suchen“ oder „installieren“ aus, Status schreibt allein root",
        en: "The app gets no root privileges for this: a systemd watcher only runs “check” or “install”, and only root writes the status",
      },
      {
        type: "besser",
        text: "Bestehende Installationen richten die Funktion beim nächsten automatischen Update selbst ein",
        en: "Existing installations set up the feature themselves with the next automatic update",
      },
    ],
  },
  {
    version: "0.1.7",
    date: "2026-09-10",
    title: "Version aus den Commits",
    titleEn: "Version from commits",
    changes: [
      {
        type: "neu",
        text: "Die Version ergibt sich automatisch aus der Zahl der Commits – jeder Commit ist ein Update (16 → 0.1.6, 100 → 1.0.0)",
        en: "The version is derived automatically from the number of commits – every commit is an update (16 → 0.1.6, 100 → 1.0.0)",
      },
      {
        type: "neu",
        text: "Fußzeile, Änderungsverlauf und Admin-Bereich zeigen Version, Update-Nummer und Commit (verlinkt)",
        en: "Footer, changelog and admin area show the version, update number and commit (linked)",
      },
      {
        type: "besser",
        text: "Der update-Befehl reicht Commit und Update-Nummer an den Build weiter und rechnet auch bei --status und --check so",
        en: "The update command passes the commit and update number to the build and uses the same logic for --status and --check",
      },
      {
        type: "besser",
        text: "Der Health-Endpunkt meldet Version, Commit und Update-Nummer",
        en: "The health endpoint reports version, commit and update number",
      },
    ],
  },
  {
    version: "0.1.6",
    date: "2026-09-10",
    title: "Fokus in Dialogen",
    titleEn: "Focus in dialogs",
    changes: [
      {
        type: "fix",
        text: "Dialoge rissen beim Tippen den Fokus aus dem Eingabefeld (Schnellerfassung, „Design teilen“, Passwort im Admin-Bereich)",
        en: "Dialogs stole focus from the input field while typing (quick capture, “Share design”, password in the admin area)",
      },
      {
        type: "fix",
        text: "Dialoge starten im ersten Eingabefeld statt auf dem Schließen-Knopf",
        en: "Dialogs now start in the first input field instead of on the close button",
      },
    ],
  },
  {
    version: "0.1.5",
    date: "2026-09-10",
    title: "Schnellsuche und Schnellerfassung",
    titleEn: "Quick search and quick capture",
    changes: [
      {
        type: "neu",
        text: "Schnellsuche mit Strg+K (Mac: Cmd+K): Projekte, Notizen, Aufgaben und Bereiche – komplett per Tastatur",
        en: "Quick search with Ctrl+K (Mac: Cmd+K): projects, notes, tasks and sections – fully keyboard-driven",
      },
      {
        type: "neu",
        text: "Schnellerfassung über das Blitz-Symbol: Idee oder Aufgabe mit einem Enter anlegen, der Dialog bleibt für die nächste offen",
        en: "Quick capture via the lightning bolt icon: create an idea or task with a single Enter, the dialog stays open for the next one",
      },
      {
        type: "neu",
        text: "Volltextsuche über Notizen und Aufgaben mit deutschen Wortstämmen – „Webhook“ findet auch „Webhooks“",
        en: "Full-text search across notes and tasks with German word stemming – “Webhook” also finds “Webhooks”",
      },
      {
        type: "neu",
        text: "Die Suche im Dashboard zeigt Treffer in Notizen und Aufgaben und blendet die betroffenen Projekte ein",
        en: "Dashboard search shows matches in notes and tasks and surfaces the matching projects",
      },
      {
        type: "besser",
        text: "GIN-Indizes für die Volltextsuche, Fundstellen werden hervorgehoben (als Text, nie als HTML)",
        en: "GIN indexes for full-text search; matches are highlighted (as text, never as HTML)",
      },
    ],
  },
  {
    version: "0.1.4",
    date: "2026-09-10",
    title: "Kleine Korrektur",
    titleEn: "Small fix",
    changes: [
      {
        type: "fix",
        text: "Admin-Seite: „3 Konten“ statt „3 Kontoen“",
        en: "Admin page: fixed the German plural for accounts (“3 Konten” instead of “3 Kontoen”)",
      },
    ],
  },
  {
    version: "0.1.3",
    date: "2026-09-10",
    title: "Administration",
    titleEn: "Administration",
    changes: [
      {
        type: "neu",
        text: "Admin-Seite: Betriebsart (Einzel- oder Mehrbenutzer), Selbstregistrierung und Karten je Spalte im Aufgabenbrett",
        en: "Admin page: operating mode (single or multi-user), self-registration and cards per column on the task board",
      },
      {
        type: "neu",
        text: "Konten anlegen, Rolle wechseln, deaktivieren, entsperren, Passwort neu setzen (beendet alle Sitzungen) und löschen",
        en: "Create accounts, change roles, deactivate, unlock, reset passwords (ends all sessions) and delete",
      },
      {
        type: "neu",
        text: "Übersicht je Konto: Projektzahl, Passkeys, Zwei-Faktor, letzte Anmeldung, Sperrstatus",
        en: "Per-account overview: number of projects, passkeys, two-factor, last sign-in, lock status",
      },
      {
        type: "besser",
        text: "Schutzregeln: Der letzte aktive Administrator bleibt, das eigene Konto lässt sich weder löschen noch deaktivieren",
        en: "Safeguards: the last active administrator always remains, and you can't delete or deactivate your own account",
      },
      {
        type: "besser",
        text: "Wechsel in den Einzelbetrieb nur mit genau einem Konto – niemand wird ausgesperrt",
        en: "Switching to single-user mode requires exactly one account – nobody gets locked out",
      },
    ],
  },
  {
    version: "0.1.2",
    date: "2026-09-10",
    title: "Passkeys",
    titleEn: "Passkeys",
    changes: [
      {
        type: "neu",
        text: "Passkeys: anmelden per Fingerabdruck, Gesichtserkennung oder Sicherheitsschlüssel – ohne Passwort und ohne Benutzernamen",
        en: "Passkeys: sign in with your fingerprint, face or a security key – no password and no username needed",
      },
      {
        type: "neu",
        text: "Mehrere Passkeys je Konto, benennbar und einzeln entfernbar, mit „zuletzt benutzt“",
        en: "Multiple passkeys per account, nameable and individually removable, with “last used”",
      },
      {
        type: "neu",
        text: "Der Passkey ersetzt den zweiten Faktor – nach der Passkey-Anmeldung wird kein Code abgefragt",
        en: "A passkey replaces the second factor – no code is requested after signing in with a passkey",
      },
      {
        type: "besser",
        text: "Einmal gültige Challenges aus der Datenbank, Signaturzähler gegen geklonte Schlüssel",
        en: "Single-use challenges from the database, signature counter against cloned keys",
      },
      {
        type: "besser",
        text: "Klarer Hinweis, wenn Passkeys mangels HTTPS nicht verfügbar sind",
        en: "Clear notice when passkeys aren't available due to missing HTTPS",
      },
    ],
  },
  {
    version: "0.1.1",
    date: "2026-09-10",
    title: "Zwei-Faktor-Anmeldung",
    titleEn: "Two-factor sign-in",
    changes: [
      {
        type: "neu",
        text: "Einmalcodes (TOTP) mit jeder gängigen Authenticator-App – Einrichtung per QR-Code oder Schlüssel",
        en: "One-time codes (TOTP) with any common authenticator app – set up via QR code or key",
      },
      {
        type: "neu",
        text: "Scharf erst nach einem bestätigten Code – wer beim Scannen scheitert, sperrt sich nicht aus",
        en: "Only activated after a confirmed code – if scanning fails, you won't lock yourself out",
      },
      {
        type: "neu",
        text: "Zehn Wiederherstellungscodes, nur einmal angezeigt, jeder genau einmal gültig; kopieren oder als Datei sichern",
        en: "Ten recovery codes, shown only once, each valid exactly once; copy them or save them as a file",
      },
      {
        type: "neu",
        text: "Anmeldung in zwei Schritten: erst Passwort, dann Code oder Wiederherstellungscode",
        en: "Two-step sign-in: password first, then a code or recovery code",
      },
      {
        type: "neu",
        text: "Abschalten und neue Codes verlangen das Passwort – eine offene Sitzung allein reicht nicht",
        en: "Turning it off and generating new codes requires your password – an open session alone isn't enough",
      },
      {
        type: "besser",
        text: "Ein Code gilt nur einmal: abgefangene Codes lassen sich nicht wiederverwenden",
        en: "Each code works only once: intercepted codes can't be reused",
      },
    ],
  },
  {
    version: "0.1.0",
    date: "2026-09-10",
    title: "Mein Konto",
    titleEn: "My account",
    changes: [
      {
        type: "neu",
        text: "Neue Seite „Mein Konto“: Anzeigename und E-Mail ändern",
        en: "New “My account” page: change your display name and email",
      },
      {
        type: "neu",
        text: "Passwort setzen oder wechseln – alle anderen Geräte werden dabei abgemeldet, dieses bleibt angemeldet",
        en: "Set or change your password – all other devices are signed out, this one stays signed in",
      },
      {
        type: "neu",
        text: "Aktive Sitzungen mit Browser, Betriebssystem, IP und letzter Aktivität; einzeln oder überall sonst abmelden",
        en: "Active sessions with browser, operating system, IP and last activity; sign out individually or everywhere else",
      },
      {
        type: "besser",
        text: "Benutzermenü mit direkten Wegen zu Konto und Design",
        en: "User menu with direct links to account and design",
      },
    ],
  },
  {
    version: "0.0.9",
    date: "2026-09-10",
    title: "Aufgaben über alle Projekte",
    titleEn: "Tasks across all projects",
    changes: [
      {
        type: "neu",
        text: "Neue Seite „Aufgaben“: jede Aufgabe aus jedem Projekt, nach Fälligkeit geordnet – Überfällig, Heute, Diese Woche, Später, Ohne Termin",
        en: "New “Tasks” page: every task from every project, sorted by due date – Overdue, Today, This week, Later, No due date",
      },
      {
        type: "neu",
        text: "Filter nach Status und Projekt, Erledigtes einblendbar",
        en: "Filter by status and project, with an option to show completed tasks",
      },
      {
        type: "neu",
        text: "Abhaken und Bearbeiten direkt aus der Liste – inklusive nächster Fassung bei wiederkehrenden Aufgaben",
        en: "Check off and edit right from the list – including the next occurrence of recurring tasks",
      },
      {
        type: "besser",
        text: "Den heutigen Tag bestimmt der Server in fester Zeitzone (Europe/Berlin) – abends kippt nichts in den falschen Tag",
        en: "The server determines today's date in a fixed time zone (Europe/Berlin) – nothing slips into the wrong day in the evening",
      },
    ],
  },
  {
    version: "0.0.8",
    date: "2026-09-10",
    title: "Aufgaben je Projekt",
    titleEn: "Tasks per project",
    changes: [
      {
        type: "neu",
        text: "Aufgabenbrett mit Offen · In Arbeit · Blockiert · Erledigt – Ziehen zwischen und innerhalb der Spalten, die Reihenfolge wird gespeichert",
        en: "Task board with Open · In progress · Blocked · Done – drag between and within columns, the order is saved",
      },
      {
        type: "neu",
        text: "Schnell anlegen per Enter, Details im Dialog: Beschreibung (Markdown), Fälligkeit, Labels, Wiederholung",
        en: "Quick add with Enter, details in a dialog: description (Markdown), due date, labels, recurrence",
      },
      {
        type: "neu",
        text: "Fälligkeiten färben sich: überfällig rot, heute gelb, bald im Akzent",
        en: "Due dates are color-coded: overdue red, today yellow, soon in the accent color",
      },
      {
        type: "neu",
        text: "Wiederkehrende Aufgaben (täglich bis monatlich): beim Erledigen entsteht die nächste Fassung – gerechnet vom Fälligkeitsdatum",
        en: "Recurring tasks (daily to monthly): completing one creates the next occurrence – calculated from the due date",
      },
      {
        type: "neu",
        text: "Fortschritt aus Aufgaben: pro Projekt einschaltbar, auf der Karte steht „3/8“",
        en: "Progress from tasks: can be turned on per project, the card shows “3/8”",
      },
      {
        type: "neu",
        text: "Spalten zeigen höchstens 15 Karten, der Rest hinter „n weitere anzeigen“",
        en: "Columns show at most 15 cards, the rest behind “Show n more”",
      },
      {
        type: "besser",
        text: "Projekt-Kanban und Aufgabenbrett teilen sich dieselbe Drag-and-Drop-Grundlage",
        en: "Project kanban and task board share the same drag-and-drop foundation",
      },
    ],
  },
  {
    version: "0.0.7",
    date: "2026-09-10",
    title: "Notizen mit Markdown",
    titleEn: "Notes with Markdown",
    changes: [
      {
        type: "neu",
        text: "Beliebig viele Notizen je Projekt mit optionalem Titel – Überschriften, Listen, Tabellen, Code und echte Checklisten per Markdown",
        en: "As many notes per project as you like, with an optional title – headings, lists, tables, code and real checklists via Markdown",
      },
      {
        type: "neu",
        text: "Schreiben und Vorschau im Wechsel, Strg+Enter speichert",
        en: "Switch between write and preview, Ctrl+Enter saves",
      },
      {
        type: "neu",
        text: "Notizen anpinnen – angepinnte stehen oben und sind hervorgehoben",
        en: "Pin notes – pinned notes stay on top and are highlighted",
      },
      {
        type: "neu",
        text: "„bearbeitet vor …“ erscheint nur bei echter Änderung, nicht beim Anpinnen",
        en: "“Edited … ago” only appears after a real change, not when pinning",
      },
      {
        type: "besser",
        text: "Projektbeschreibung wird als Markdown dargestellt",
        en: "Project descriptions are rendered as Markdown",
      },
      {
        type: "besser",
        text: "Rohes HTML, javascript:-Links und fremde Bilder werden beim Darstellen entfernt",
        en: "Raw HTML, javascript: links and external images are stripped when rendering",
      },
    ],
  },
  {
    version: "0.0.6",
    date: "2026-09-10",
    title: "Kanban und Mehrfachauswahl",
    titleEn: "Kanban and multi-select",
    changes: [
      {
        type: "neu",
        text: "Kanban-Ansicht: Spalten je Status, Karten am Griff ziehen – mit Maus, per Touch nach kurzem Halten oder mit der Tastatur",
        en: "Kanban view: one column per status, drag cards by their handle – with the mouse, by touch after a short hold, or with the keyboard",
      },
      {
        type: "neu",
        text: "Freie Reihenfolge innerhalb einer Spalte wird gespeichert; reines Umsortieren ändert das Änderungsdatum nicht",
        en: "Custom order within a column is saved; reordering alone doesn't change the modified date",
      },
      {
        type: "neu",
        text: "Mehrfachauswahl: Status setzen, Tags ergänzen oder entfernen, Favoriten markieren, löschen",
        en: "Multi-select: set status, add or remove tags, mark favorites, delete",
      },
      {
        type: "besser",
        text: "Was der Filter ausblendet, fällt aus der Auswahl – Massenänderungen treffen nur Sichtbares",
        en: "Anything hidden by the filter drops out of the selection – bulk changes only affect what's visible",
      },
    ],
  },
  {
    version: "0.0.5",
    date: "2026-09-10",
    title: "Projekte und Dashboard",
    titleEn: "Projects and dashboard",
    changes: [
      {
        type: "neu",
        text: "Projekte anlegen, bearbeiten und löschen – ein Name genügt, alles andere lässt sich nachtragen",
        en: "Create, edit and delete projects – a name is all you need, everything else can be added later",
      },
      {
        type: "neu",
        text: "Sechs Status von Idee bis Archiviert, direkt auf der Karte umschaltbar; Priorität, Fortschritt, Akzentfarbe, Tags, Favoriten, Repository-Adresse",
        en: "Six statuses from idea to archived, switchable right on the card; priority, progress, accent color, tags, favorites, repository URL",
      },
      {
        type: "neu",
        text: "Dashboard mit Kennzahlen, Suche, Statusfiltern, fünf Sortierungen und drei Ansichten (Raster, Liste, nach Status)",
        en: "Dashboard with key figures, search, status filters, five sort options and three views (grid, list, by status)",
      },
      {
        type: "neu",
        text: "Projektseite mit allen Angaben; Ansicht, Sortierung und Archiv-Schalter werden im Browser gemerkt",
        en: "Project page with all details; view, sort order and archive toggle are remembered in the browser",
      },
      {
        type: "neu",
        text: "Verlauf je Projekt (Anlegen, Statuswechsel, Bearbeitungen) als Grundlage für Rückblick und Zeitleiste",
        en: "History per project (creation, status changes, edits) as the basis for reviews and a timeline",
      },
    ],
  },
  {
    version: "0.0.4",
    date: "2026-09-10",
    title: "Design-Editor",
    titleEn: "Design editor",
    changes: [
      {
        type: "neu",
        text: "Eigene Seite „Design“ mit Live-Vorschau – jede Änderung ist sofort sichtbar, gespeichert wird erst auf Knopfdruck",
        en: "Dedicated “Design” page with live preview – every change is visible instantly, nothing is saved until you click the button",
      },
      {
        type: "neu",
        text: "Sieben Farbschemata, freie Akzentfarbe, komplette Palette für Hell und Dunkel mit Kontrastprüfung, eigene Statusfarben",
        en: "Seven color schemes, any accent color, a full palette for light and dark with contrast checking, custom status colors",
      },
      {
        type: "neu",
        text: "Glas-Effekt: Deckkraft und Unschärfe der Karten stufenlos regelbar",
        en: "Glass effect: card opacity and blur are continuously adjustable",
      },
      {
        type: "neu",
        text: "Hintergrund: neun animierte Vorlagen mit Tempo, Intensität und eigenen Farben",
        en: "Background: nine animated presets with speed, intensity and custom colors",
      },
      {
        type: "neu",
        text: "Eigener Farbverlauf (linear, radial, konisch) mit bis zu sechs Farben, Animation und zehn Vorlagen",
        en: "Custom gradient (linear, radial, conic) with up to six colors, animation and ten presets",
      },
      {
        type: "neu",
        text: "Eigene Hintergrundbilder hochladen (PNG, JPEG, WebP, GIF, AVIF) mit Unschärfe, Abdunkelung und Anordnung",
        en: "Upload your own background images (PNG, JPEG, WebP, GIF, AVIF) with blur, dimming and positioning",
      },
      {
        type: "neu",
        text: "Designs als JSON exportieren und importieren",
        en: "Export and import designs as JSON",
      },
    ],
  },
  {
    version: "0.0.3",
    date: "2026-09-10",
    title: "Proxmox-Installer und Auto-Update",
    titleEn: "Proxmox installer and auto-update",
    changes: [
      {
        type: "neu",
        text: "Einzeiler für den Proxmox-Host: legt einen Debian-LXC an und installiert alles (Standard- und Erweitert-Modus)",
        en: "One-liner for the Proxmox host: creates a Debian LXC and installs everything (default and advanced mode)",
      },
      {
        type: "neu",
        text: "update-Befehl im Container mit --status, --check, --rollback, --ref, --auto-on/--auto-off",
        en: "update command in the container with --status, --check, --rollback, --ref, --auto-on/--auto-off",
      },
      {
        type: "neu",
        text: "Auto-Update alle 15 Minuten: eigener Release je Version, Datenbank-Backup vor der Migration, automatischer Rollback bei fehlgeschlagenem Health-Check",
        en: "Auto-update every 15 minutes: a separate release per version, database backup before migrating, automatic rollback if the health check fails",
      },
      {
        type: "neu",
        text: "Installationsanleitung unter docs/INSTALLATION.md",
        en: "Installation guide at docs/INSTALLATION.md",
      },
    ],
  },
  {
    version: "0.0.2",
    date: "2026-09-10",
    title: "Anmeldung",
    titleEn: "Sign-in",
    changes: [
      {
        type: "neu",
        text: "Einrichtungsassistent für das Administratorkonto mit Einzel- oder Mehrbenutzerbetrieb",
        en: "Setup wizard for the administrator account with single or multi-user mode",
      },
      {
        type: "neu",
        text: "Anmeldung mit Benutzername und Passwort (scrypt), serverseitige Sitzungen",
        en: "Sign-in with username and password (scrypt), server-side sessions",
      },
      {
        type: "neu",
        text: "Selbstregistrierung im Mehrbenutzerbetrieb (abschaltbar)",
        en: "Self-registration in multi-user mode (can be turned off)",
      },
      {
        type: "neu",
        text: "Schutz vor Passwortraten: Ratenbegrenzung und 15 Minuten Sperre nach 8 Fehlversuchen",
        en: "Protection against password guessing: rate limiting and a 15-minute lockout after 8 failed attempts",
      },
      {
        type: "neu",
        text: "Navigation, Benutzermenü und Änderungsverlauf hinter der Versionsnummer",
        en: "Navigation, user menu and a changelog behind the version number",
      },
    ],
  },
  {
    version: "0.0.1",
    date: "2026-09-10",
    title: "Grundgerüst",
    titleEn: "Foundation",
    changes: [
      {
        type: "neu",
        text: "Projektgerüst mit Next.js 15, Tailwind CSS 4, Prisma und PostgreSQL",
        en: "Project scaffold with Next.js 15, Tailwind CSS 4, Prisma and PostgreSQL",
      },
      {
        type: "neu",
        text: "Theme-Engine: animierte Hintergründe, Farbschemata, Hell/Dunkel und Glas-Effekt",
        en: "Theme engine: animated backgrounds, color schemes, light/dark and glass effect",
      },
      {
        type: "neu",
        text: "Health-Endpunkt und strikte Sicherheits-Header mit CSP-Nonce",
        en: "Health endpoint and strict security headers with a CSP nonce",
      },
    ],
  },
];

export const CURRENT_VERSION = CHANGELOG[0].version;
