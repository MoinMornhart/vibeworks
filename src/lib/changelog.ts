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
  /** Seite oder Einstellung der Neuerung (Pfad dieser Instanz) – Hinweis in der Glocke und „Ansehen“ im Verlauf führen dorthin */
  link?: string;
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
    version: "1.0.6",
    date: "2026-09-16",
    title: "Für KI gesperrte Bereiche, Issues nur unter eigenem Namen",
    titleEn: "Areas locked for AI, issues only under your own name",
    changes: [
      {
        type: "neu",
        text: "Aufgaben und ganze Spalten lassen sich „für KI sperren“: Über MCP sind sie unsichtbar (Listen, Suche, Heute, Probleme, CLAUDE.md), direkte Zugriffe melden „nicht gefunden“, und das Issue zeigt keinen Inhalt",
        en: "Tasks and whole columns can be “locked for AI”: they are invisible over MCP (lists, search, today, problems, CLAUDE.md), direct access reports “not found”, and the issue shows no content",
      },
      {
        type: "fix",
        text: "Sicherheit: Aufgaben, die nicht der Projektbesitzer angelegt hat, landen nicht mehr unter dessen GitHub-Konto – das Issue schreibt der eigene Git-Zugang der Person oder der Bot, sonst gibt es einen klaren Hinweis",
        en: "Security: tasks not created by the project owner no longer appear under the owner's GitHub account – the person's own Git access or the bot writes the issue, otherwise there's a clear notice",
      },
    ],
  },
  {
    version: "1.0.5",
    date: "2026-09-16",
    title: "Bot mit Befehlen, Unterhaltung im Info-Fenster",
    titleEn: "Bot commands, conversation in the info panel",
    changes: [
      {
        type: "neu",
        text: "Der Bot hört auf Befehle in Issue-Kommentaren: /status erledigt, /prio 3, /übernehmen, /fällig 01.10.2026, /ki Hinweis, /info, /hilfe – nur von Mitarbeitenden mit Schreibrecht, und er antwortet jedes Mal im Issue",
        en: "The bot follows commands in issue comments: /status erledigt, /prio 3, /übernehmen, /fällig 01.10.2026, /ki note, /info, /hilfe – only from collaborators with write access, and it always replies in the issue",
      },
      {
        type: "neu",
        text: "Info-Fenster: die Unterhaltung aus dem Issue lesen und direkt aus VibeWorks antworten – dein Name steht dabei",
        en: "Info panel: read the issue conversation and reply straight from VibeWorks – your name is added",
      },
      {
        type: "besser",
        text: "KI-Schritte im Info-Fenster zeigen jetzt auch, welche KI eine Aufgabe nur gelesen hat (z. B. per list_tasks), und jede KI hat eine feste Kennung (KI-ID), die auch bei den API-Schlüsseln steht",
        en: "AI steps in the info panel now also show which AI only read a task (e.g. via list_tasks), and every AI has a fixed ID that also appears with the API keys",
      },
      {
        type: "besser",
        text: "Konto → Git-Zugänge erklärt, wie der Bot arbeitet",
        en: "Account → Git access explains how the bot works",
        link: "/account#git-zugang",
      },
    ],
  },
  {
    version: "1.0.4",
    date: "2026-09-16",
    title: "Code-Netz sagt, was los ist",
    titleEn: "Code network tells you what's going on",
    changes: [
      {
        type: "fix",
        text: "Code-Netz scheitert nicht mehr still: Es sagt, wenn das Repository noch nicht abgeglichen ist, der Abgleich scheitert, keine Dateien lesbar sind oder nur ein älterer Stand gezeigt wird – und meldet kurz, wenn das Laden geklappt hat",
        en: "The code network no longer fails silently: it says when the repository hasn't been synced, sync fails, no files are readable or only an older state is shown – and briefly confirms when loading worked",
      },
      {
        type: "fix",
        text: "Automatische Aufgaben (Fehler als Aufgabe, Repo-Check) tragen nicht mehr „Claude“ als Bearbeiter ein – das Feld bleibt leer, bis jemand die Aufgabe übernimmt",
        en: "Automatic tasks (error to task, repo check) no longer fill in “Claude” as assignee – the field stays empty until someone takes the task",
      },
      {
        type: "besser",
        text: "MCP: Fehlermeldungen und Hinweise für die KI sind immer englisch; Inhalte bleiben in deiner Sprache",
        en: "MCP: error messages and notes for the AI are always English; content stays in your language",
      },
      {
        type: "neu",
        text: "Ändern sich die Agenten-Regeln, erinnert VibeWorks die KI, sie neu zu holen – unter Konto → API-Schlüssel steht dann „Regeln veraltet“",
        en: "When the agent rules change, VibeWorks reminds the AI to fetch them again – Account → API keys then shows “Rules outdated”",
      },
    ],
  },
  {
    version: "1.0.3",
    date: "2026-09-16",
    title: "Absturzberichte kommen an",
    titleEn: "Crash reports get through",
    changes: [
      {
        type: "fix",
        text: "Fehler-Eingang: Eine Absturzschleife mit Hunderten Meldungen blockiert nicht mehr alles – Apps schicken bis zu 50 Berichte in einer Anfrage, gleiche Abstürze werden zusammengezählt",
        en: "Error inbox: a crash loop with hundreds of reports no longer blocks everything – apps send up to 50 reports in one request, identical crashes are counted together",
      },
      {
        type: "besser",
        text: "Der Fehler-Eingang versteht mehr Formate: verschachtelte Fehler, deutsche Feldnamen (nachricht, typ), Zusatzangaben wie Absturzgrund und Exit-Code sowie Log-Zeilen wie „<Zeit> [CRASH] Text“",
        en: "The error inbox understands more formats: nested errors, German field names (nachricht, typ), extra details like crash reason and exit code, and log lines like “<time> [CRASH] text”",
      },
      {
        type: "neu",
        text: "Einbau-Schnipsel für Electron-Apps: meldet abgestürzte Renderer- und GPU-Prozesse gesammelt",
        en: "Snippet for Electron apps: reports crashed renderer and GPU processes in batches",
      },
    ],
  },
  {
    version: "1.0.2",
    date: "2026-09-16",
    title: "Bot per Klick, KI-Agenten schreiben Deutsch",
    titleEn: "One-click bot, AI agents write in your language",
    changes: [
      {
        type: "neu",
        text: "Bot per Klick: Unter Konto → Git-Zugänge legt ein Knopf bei GitHub eine eigene App an – nur Name und Repositories bestätigen, kein zweites Konto, kein Token. Sie darf nur Issues schreiben (kein Code, keine Webhooks); Issues erscheinen dann als Bot",
        en: "One-click bot: under Account → Git access a button creates your own GitHub app – just confirm name and repositories, no second account, no token. It can only write issues (no code, no webhooks); issues then appear as the bot",
        link: "/account#git-zugang",
      },
      {
        type: "fix",
        text: "KI-Agenten legen Aufgaben, Beschreibungen und Notizen jetzt in der Sprache deines Kontos an statt auf Englisch",
        en: "AI agents now create tasks, descriptions and notes in your account's language instead of English",
      },
      {
        type: "besser",
        text: "Agenten-Regeln: keine Antwort mehr ohne Blick auf die offenen Aufgaben über MCP, und offene Aufgaben werden vollständig abgearbeitet",
        en: "Agent rules: no reply without checking open tasks over MCP, and open tasks are worked through completely",
      },
    ],
  },
  {
    version: "1.0.1",
    date: "2026-09-16",
    title: "Eigene Spaltennamen überall, Hinweis an die KI",
    titleEn: "Custom column names everywhere, note for the AI",
    changes: [
      {
        type: "fix",
        text: "Umbenannte Spalten (z. B. „Blockiert“) heißen jetzt überall so – in der Aufgabenliste, im Aufgaben-Dialog, im Info-Fenster und auf der Team-Seite, nicht nur im Board",
        en: "Renamed columns (e.g. “Blocked”) now show their name everywhere – in the task list, the task dialog, the info panel and the team page, not just on the board",
      },
      {
        type: "besser",
        text: "„Hinweis an Claude“ heißt jetzt „Hinweis an die KI“ – er gilt für jedes Modell. Ein hinterlegter Hinweis ist auf der Karte (KI-Symbol) und im Aufgaben-Dialog zu sehen",
        en: "“Note for Claude” is now “Note for the AI” – it applies to any model. A saved note shows on the card (AI badge) and in the task dialog",
      },
      {
        type: "besser",
        text: "Lässt sich die Code-Kopie für Code-Netz und Code-Suche nicht holen, bekommst du eine Benachrichtigung – höchstens einmal am Tag je Projekt, mit direktem Link",
        en: "If the code copy for the code network and code search can't be fetched, you get a notification – at most once a day per project, with a direct link",
      },
      {
        type: "fix",
        text: "Sicherheit (Repo-Check): Verschlüsselung verlangt die volle Prüfsummenlänge, Übersetzungen lesen nur eigene Einträge, Protokolle nutzen feste Formatstrings, und ein weiterer regulärer Ausdruck kommt ohne Nutzereingabe aus",
        en: "Security (repo check): encryption requires the full authentication tag length, translations only read own entries, logs use fixed format strings, and another regular expression no longer depends on input",
      },
    ],
  },
  {
    version: "1.0.0",
    date: "2026-09-17",
    title: "Beta-Ansicht für Admins",
    titleEn: "Beta view for admins",
    changes: [
      {
        type: "neu",
        text: "Admins können unter Administration → Einstellungen die Beta-Ansicht starten: Dort erscheinen künftig neue Oberflächen zuerst – nur zum Ansehen, das Backend nimmt in dieser Zeit keine Änderungen an. Ein roter Balken oben zeigt den Modus, das rote ✕ beendet ihn. Andere Konten merken davon nichts",
        en: "Admins can start the beta view under Administration → Settings: upcoming screens will appear there first – for looking only, the backend accepts no changes meanwhile. A red bar at the top shows the mode, the red ✕ ends it. Other accounts are not affected",
        link: "/admin",
      },
    ],
  },
  {
    version: "0.9.9",
    date: "2026-09-17",
    title: "Fehler-Agent",
    titleEn: "Error agent",
    changes: [
      {
        type: "neu",
        text: "Fehler-Eingang: Mit dem Fehler-Agent wird jeder neue Fehler – und jeder erledigte, der wiederkommt – sofort zur Notfix-Aufgabe für Claude: dringend, heute fällig, ohne Stack-Details. Einschalten kann der Besitzer im Fehler-Eingang; höchstens 5 Aufgaben pro Stunde",
        en: "Error inbox: with the error agent, every new error – and every resolved one that comes back – instantly becomes a Notfix task for Claude: urgent, due today, without stack details. The owner switches it on in the error inbox; at most 5 tasks per hour",
      },
      {
        type: "fix",
        text: "Entwicklung: Die Test-Umgebung ist zurück auf vitest 4",
        en: "Development: the test runner is back on vitest 4",
      },
    ],
  },
  {
    version: "0.9.8",
    date: "2026-09-17",
    title: "Code-Netz: Vollbild und Mausrad",
    titleEn: "Code network: full screen and mouse wheel",
    changes: [
      {
        type: "fix",
        text: "Code-Netz: Das Mausrad zoomt jetzt das Netz, statt die ganze Seite zu scrollen",
        en: "Code network: the mouse wheel now zooms the network instead of scrolling the whole page",
      },
      {
        type: "neu",
        text: "Code-Netz im Vollbild – ein Klick, und das Netz füllt das ganze Fenster (Esc beendet). Klappt das Holen der Code-Kopie nicht, steht jetzt verständlich da, warum, und „Kopie jetzt holen“ versucht es sofort noch einmal",
        en: "Code network in full screen – one click and the network fills the whole window (Esc exits). If fetching the code copy fails, it now says why in plain words, and “Fetch copy now” retries right away",
      },
    ],
  },
  {
    version: "0.9.7",
    date: "2026-09-17",
    title: "Eingeschränkt statt kaputt",
    titleEn: "Limited, not broken",
    changes: [
      {
        type: "fix",
        text: "Sind in einem Repository die Issues abgeschaltet, versucht VibeWorks es nicht mehr bei jedem Abgleich neu – das sparte keine GitHub-Aufrufe und konnte andere Projekte ausbremsen. Stattdessen pausieren die Issues einen Tag, die Fehlermarken an den Aufgaben verschwinden, und das Projekt zeigt einen ruhigen Hinweis mit „Jetzt erneut prüfen“. Commits, CI und Abhängigkeiten laufen ganz normal weiter",
        en: "If issues are disabled in a repository, VibeWorks no longer retries on every sync – that wasted GitHub calls and could slow down other projects. Instead, issues pause for a day, the error marks on tasks disappear and the project shows a calm note with “Check again now”. Commits, CI and dependencies keep working as usual",
      },
      {
        type: "besser",
        text: "Die KI sieht in get_repo_status jetzt, welche Bereiche eingeschränkt sind (Commits, Issues, CI, Abhängigkeiten) – und dass der Rest des Repositories trotzdem funktioniert",
        en: "The AI now sees in get_repo_status which areas are limited (commits, issues, CI, dependencies) – and that the rest of the repository still works",
      },
    ],
  },
  {
    version: "0.9.6",
    date: "2026-09-17",
    title: "Wünsche pro Tag einstellbar",
    titleEn: "Wishes per day configurable",
    changes: [
      {
        type: "neu",
        text: "Administration: Wie viele Wünsche (z. B. an Claude) jedes Team-Mitglied pro Tag einreichen darf, ist jetzt einstellbar – 1 bis 20, Standard 3",
        en: "Administration: how many wishes (e.g. for Claude) each team member may submit per day is now configurable – 1 to 20, default 3",
      },
      {
        type: "besser",
        text: "Klarere Beschriftungen: Bei ntfy, Webhook und E-Mail steht jetzt, ob VibeWorks dorthin sendet (Benachrichtigungen) oder von dort empfängt (Ideen-Eingang)",
        en: "Clearer labels: ntfy, webhook and e-mail now say whether VibeWorks sends there (notifications) or receives from there (idea inbox)",
      },
    ],
  },
  {
    version: "0.9.5",
    date: "2026-09-17",
    title: "Einstellungen je MCP-Schlüssel",
    titleEn: "Settings per MCP key",
    changes: [
      {
        type: "neu",
        text: "Jeder API-Schlüssel hat jetzt eigene Einstellungen: was die KI damit darf (nur lesen, lesen und Aufgaben, alles) und wie sie erinnert wird – Standard-Erinnerung, eigener Text oder aus, bei jedem n-ten Aufruf. So vergisst die KI nicht, den Status aktuell zu halten",
        en: "Every API key now has its own settings: what the AI may do with it (read only, read and tasks, everything) and how it is reminded – default reminder, custom text or off, on every n-th call. That way the AI doesn't forget to keep the status up to date",
        link: "/account#mcp",
      },
    ],
  },
  {
    version: "0.9.4",
    date: "2026-09-17",
    title: "Feedback-Eingang",
    titleEn: "Feedback inbox",
    changes: [
      {
        type: "neu",
        text: "Community: Wer eigene Projekte vorstellt, sieht jetzt „Feedback zu deinen Projekten“ – alle Ideen, Fragen und Fehlerberichte an einem Ort, filterbar nach offen und Art, mit Direktlink zum Beitrag",
        en: "Community: anyone showcasing projects now sees “Feedback on your projects” – all ideas, questions and bug reports in one place, filterable by open and kind, with a direct link to the post",
        link: "/community",
      },
      {
        type: "neu",
        text: "Admins können Community-Projekte als „offiziell“ markieren – sie stehen dann ganz oben und tragen ein Abzeichen, damit Neue wissen, wo ihr Feedback besonders willkommen ist",
        en: "Admins can mark community projects as “official” – they appear at the top with a badge, so newcomers know where their feedback is especially welcome",
      },
    ],
  },
  {
    version: "0.9.3",
    date: "2026-09-17",
    title: "Klare Rückmeldungen",
    titleEn: "Clear feedback",
    changes: [
      {
        type: "besser",
        text: "Legt man eine Aufgabe aus dem Repo-Check oder dem Fehler-Eingang an, erscheint unten rechts „Aufgabe erfolgreich erstellt“ – nicht mehr nur ein Hinweis irgendwo im Panel. Der Knopf heißt jetzt „Als Aufgabe erstellen“",
        en: "Creating a task from the repo check or the error inbox now shows “Task created successfully” in the bottom right – no longer just a note somewhere in the panel. The button is now called “Create as task”",
      },
      {
        type: "fix",
        text: "Sicherheit: Das Muster in der Code-Dateiliste (z. B. „src/*.ts“) wird ohne regulären Ausdruck geprüft – ein Muster mit sehr vielen * konnte die Prüfung sonst extrem verlangsamen. Dazu meldet Firefox keinen CSP-Hinweis zu 'self' mehr",
        en: "Security: the pattern in the code file list (e.g. “src/*.ts”) is checked without a regular expression – a pattern with very many * could otherwise slow the check down extremely. Firefox also no longer reports a CSP note about 'self'",
      },
    ],
  },
  {
    version: "0.9.2",
    date: "2026-09-17",
    title: "Memo-Netz und Zweige",
    titleEn: "Memo network and branches",
    changes: [
      {
        type: "fix",
        text: "Code-Netz und Code-Suche funktionieren jetzt auch für GitHub-, GitLab- und Gitea-Projekte: VibeWorks holt dafür bei Bedarf den neuesten Commit als lokale Kopie – mit dem Git-Zugang des Projekts und bei jedem neuen Commit frisch. Bisher gab es die Kopie nur bei allgemeinen Git-Servern",
        en: "Code network and code search now also work for GitHub, GitLab and Gitea projects: VibeWorks fetches the latest commit as a local copy when needed – with the project's Git access and fresh on every new commit. Before, the copy only existed for generic Git servers",
      },
      {
        type: "neu",
        text: "Memo-Netz: an jede Datei im Code-Netz lassen sich Memos heften – Stolperfallen, Zusammenhänge, Hinweise. Sie erscheinen als gelbe Punkte, und die KI kann sie über MCP lesen, anlegen und löschen",
        en: "Memo network: pin memos to any file in the code network – pitfalls, connections, hints. They show up as yellow dots, and the AI can read, add and delete them via MCP",
      },
      {
        type: "neu",
        text: "Zweig wählen: hat ein Repository mehrere Zweige, zeigt das Code-Netz jeden davon – auch Code-Suche und Dateiliste über MCP nehmen einen Zweig an. Oben steht, auf welchem Commit das Netz beruht",
        en: "Pick a branch: if a repository has several branches, the code network shows each of them – code search and the file list via MCP take a branch too. The header shows which commit the network is based on",
      },
    ],
  },
  {
    version: "0.9.1",
    date: "2026-09-17",
    title: "Hinweis an Claude",
    titleEn: "Note for Claude",
    changes: [
      {
        type: "neu",
        text: "Im Info-Fenster einer Aufgabe gibt es jetzt „Hinweis an Claude“: eigener Prompt und Arbeitsweise, mit Bausteinen wie „erst Tests schreiben“ oder „vor dem Push auf mein OK warten“. Die KI bekommt ihn über MCP bei der Aufgabe mit – privat, nie im Issue",
        en: "The task info panel now has “Note for Claude”: your own prompt and way of working, with snippets like “write tests first” or “wait for my OK before pushing”. The AI receives it with the task via MCP – private, never in the issue",
      },
      {
        type: "besser",
        text: "Repo-Check: „Als Aufgabe für Claude“ öffnet jetzt erst das Aufgaben-Fenster mit dem Vorschlag – Titel, Text, Priorität und Bearbeiter lassen sich vor dem Anlegen anpassen. Gibt es schon eine offene Aufgabe dazu, sagt VibeWorks das",
        en: "Repo check: “Task for Claude” now opens the task dialog with the suggestion first – title, text, priority and assignee can be adjusted before creating. If an open task already exists, VibeWorks says so",
      },
    ],
  },
  {
    version: "0.9.0",
    date: "2026-09-17",
    title: "Team sieht die KI arbeiten",
    titleEn: "Team sees the AI at work",
    changes: [
      {
        type: "neu",
        text: "Die Team-Seite zeigt bei „Woran arbeitet Claude gerade?“ jetzt eine laufende Uhr an Aufgaben in Arbeit und darunter die letzten Schritte der KI in den Team-Projekten – welches Werkzeug, an welcher Aufgabe, wann. Schritte aus anderen Projekten bleiben draußen",
        en: "The team page's “What is Claude working on?” now shows a running clock on tasks in progress and, below, the AI's latest steps in the team's projects – which tool, on which task, when. Steps from other projects stay out",
      },
    ],
  },
  {
    version: "0.8.9",
    date: "2026-09-17",
    title: "Code-Netz",
    titleEn: "Code network",
    changes: [
      {
        type: "neu",
        text: "Neues „Code-Netz“ auf der Projektseite: jede Datei ein Punkt, jeder Import eine Linie, farbig nach Bereich. Ziehen, zoomen, suchen – ein Klick zeigt, was eine Datei nutzt und wer sie nutzt, mit Link ins Repository. Abhängigkeiten und Repo-Check bleiben wie sie sind",
        en: "New “Code network” on the project page: each file a dot, each import a line, colored by area. Drag, zoom, search – a click shows what a file uses and who uses it, with a link into the repository. Dependencies and repo check stay as they are",
      },
      {
        type: "neu",
        text: "Die KI sieht das Netz auch: get_code_graph zeigt, welche Dateien eine Datei einbinden – damit sie vor einer Änderung weiß, was betroffen ist",
        en: "The AI sees the network too: get_code_graph shows which files import a file – so it knows what a change affects",
      },
    ],
  },
  {
    version: "0.8.8",
    date: "2026-09-17",
    title: "Konsole bleibt sauber",
    titleEn: "Clean console",
    changes: [
      {
        type: "fix",
        text: "Die Meldung „eval blockiert“ konnte auf einzelnen Seiten wiederkommen, wenn dort ein Formular geladen wurde, bevor die Einstellung dagegen griff. Sie gilt jetzt, bevor irgendein anderer Code der App im Browser läuft",
        en: "The “eval blocked” message could come back on some pages when a form loaded before the setting against it took effect. It now applies before any other app code runs in the browser",
      },
    ],
  },
  {
    version: "0.8.7",
    date: "2026-09-17",
    title: "Info-Fenster: sehen, was Claude macht",
    titleEn: "Info panel: see what Claude does",
    changes: [
      {
        type: "neu",
        text: "Jede Aufgabe hat ein Info-Fenster (ⓘ auf der Karte oder „Info“ im Dialog): aktueller Stand, jeder Schritt der KI über MCP, Commits, die das Issue nennen, der Verlauf und erfasste Zeiten. Es bleibt offen, während man weiterarbeitet, und aktualisiert sich selbst",
        en: "Every task has an info panel (ⓘ on the card or “Info” in the dialog): current state, every AI step via MCP, commits mentioning the issue, the history and tracked time. It stays open while you keep working and refreshes itself",
      },
      {
        type: "neu",
        text: "Ist eine Aufgabe in Arbeit, läuft auf der Karte eine Uhr mit – so sieht das ganze Team, wer gerade woran sitzt und wie lange schon",
        en: "While a task is in progress, a clock runs on its card – so the whole team sees who is working on what and for how long",
      },
    ],
  },
  {
    version: "0.8.6",
    date: "2026-09-16",
    title: "Abhängigkeiten aktualisiert",
    titleEn: "Dependencies updated",
    changes: [
      {
        type: "besser",
        text: "React 19.3, lucide-react 1.x (Symbole), vitest 5 und neuere Typdefinitionen – ohne sichtbare Änderungen. TypeScript 7 bleibt vorerst draußen, bis Next.js die neue Fassung unterstützt",
        en: "React 19.3, lucide-react 1.x (icons), vitest 5 and newer type definitions – with no visible changes. TypeScript 7 stays out for now until Next.js supports the new version",
      },
    ],
  },
  {
    version: "0.8.5",
    date: "2026-09-16",
    title: "Prioritäten für Aufgaben",
    titleEn: "Task priorities",
    changes: [
      {
        type: "neu",
        text: "Aufgaben haben jetzt eine Priorität – niedrig, normal, hoch oder dringend. Sie steht im Aufgaben-Dialog, als Zeichen auf der Karte und im gespiegelten Issue",
        en: "Tasks now have a priority – low, normal, high or urgent. It sits in the task dialog, shows as a marker on the card and appears in the mirrored issue",
      },
      {
        type: "besser",
        text: "Die KI arbeitet nach Priorität: list_tasks liefert Dringendes zuerst, create_task und update_task setzen die Priorität, und die Agenten-Regeln sagen es ausdrücklich. Notfix und Repo-Check-Aufgaben sind automatisch dringend bzw. hoch",
        en: "The AI works by priority: list_tasks returns urgent work first, create_task and update_task set the priority, and the agent rules say so explicitly. Notfix and repo check tasks are automatically urgent or high",
      },
    ],
  },
  {
    version: "0.8.4",
    date: "2026-09-16",
    title: "Repo-Check als Aufgaben",
    titleEn: "Repo check as tasks",
    changes: [
      {
        type: "neu",
        text: "Repo-Check: jeder Befund lässt sich mit einem Klick als Aufgabe für Claude anlegen – mit genau dem Prüfauftrag aus der Erklärung. Dazu eine Einstellung für den Besitzer, ob Aufgaben automatisch entstehen: aus, nur Dringendes (Geheimnisse, Lücken) oder alles. Die Sammel-Aufgaben halten sich selbst aktuell",
        en: "Repo check: every finding can become a task for Claude with one click – with exactly the instructions from the explanation. Plus an owner setting for automatic tasks: off, only urgent (secrets, vulnerabilities) or everything. The collective tasks keep themselves up to date",
      },
      {
        type: "fix",
        text: "Teilen: Wer Mitglieder einladen darf, sieht jetzt auch einen schon eingeschalteten öffentlichen Link und kann ihn kopieren. Ein- und Ausschalten bleibt beim Besitzer",
        en: "Sharing: anyone allowed to invite members now also sees an already enabled public link and can copy it. Switching it on or off stays with the owner",
      },
      {
        type: "besser",
        text: "GitHub-Workflows sind auf feste Versionen gepinnt – auch in der Vorlage für den Repo-Check, die bestehende Checks beim nächsten Lauf übernehmen. Dazu eine CLAUDE.md mit dem kompletten Arbeitsablauf für Issues",
        en: "GitHub workflows are pinned to fixed versions – including the repo check template, which existing checks pick up on their next run. Plus a CLAUDE.md with the complete issue workflow",
      },
    ],
  },
  {
    version: "0.8.3",
    date: "2026-09-16",
    title: "Notfix und Code-Suche",
    titleEn: "Notfix and code search",
    changes: [
      {
        type: "neu",
        text: "„Notfix“ im Fehler-Eingang: ein Klick macht aus einem Fehler eine dringende Aufgabe für Claude – heute fällig, klar gekennzeichnet. Stack und Seitenangaben bleiben wie bisher im Eingang und wandern nicht ins Issue",
        en: "“Notfix” in the error inbox: one click turns an error into an urgent task for Claude – due today, clearly marked. Stack traces and page details stay in the inbox and never reach the issue",
      },
      {
        type: "neu",
        text: "Zwei neue MCP-Werkzeuge: Claude kann jetzt die Dateien des verknüpften Repositories auflisten und im Code nach einer Stelle suchen – mit Datei, Zeile und Fundstelle, statt Pfade zu raten. Gesucht wird in der Kopie, die VibeWorks ohnehin schon geholt hat",
        en: "Two new MCP tools: Claude can list the files of the linked repository and search the code, with file, line and the matching line, instead of guessing paths. It searches the copy VibeWorks has already fetched",
      },
    ],
  },
  {
    version: "0.8.2",
    date: "2026-09-16",
    title: "Admin vergibt ein neues Passwort",
    titleEn: "Admin sets a new password",
    changes: [
      {
        type: "neu",
        text: "Auf „Passwort vergessen?“ gibt es jetzt den kurzen Weg: einen Admin um ein neues Passwort bitten. Das geht auch ohne hinterlegte E-Mail-Adresse und ohne eingerichteten E-Mail-Versand",
        en: "“Forgot your password?” now has a short path: ask an admin for a new password. This works without an e-mail address in the account and without a configured e-mail sender",
        link: "/reset",
      },
      {
        type: "besser",
        text: "Admins bekommen die Bitte als Benachrichtigung und sehen sie in der Benutzerliste; sobald sie ein Passwort setzen, verschwindet der Hinweis wieder. Höchstens eine Bitte pro Stunde und Konto",
        en: "Admins receive the request as a notification and see it in the user list; once they set a password, the marker disappears. At most one request per account per hour",
      },
    ],
  },
  {
    version: "0.8.1",
    date: "2026-09-16",
    title: "Passwort vergessen",
    titleEn: "Forgot password",
    changes: [
      {
        type: "neu",
        text: "„Passwort vergessen?“ auf der Anmeldeseite: Link an die im Konto hinterlegte E-Mail, eine Stunde gültig, nur einmal nutzbar; danach sind alle anderen Geräte abgemeldet. Muss ein Admin erst einschalten (Administration → Einstellungen) und braucht eingerichteten E-Mail-Versand. Ob es ein Konto gibt, verrät die Seite nie",
        en: "“Forgot your password?” on the sign-in page: a link to the e-mail in your account, valid for one hour, single use; afterwards all other devices are signed out. An admin has to enable it first (Administration → Settings) and e-mail sending must be configured. The page never reveals whether an account exists",
      },
      {
        type: "besser",
        text: "Sicherheitsfragen gibt es bewusst nicht – sie sind ratbar. Wer keine E-Mail hinterlegt hat, bekommt sein Passwort weiterhin vom Admin gesetzt",
        en: "Deliberately no security questions – they're guessable. Without an e-mail address, an admin still sets the password for you",
      },
    ],
  },
  {
    version: "0.8.0",
    date: "2026-09-15",
    title: "Kritisches kommt immer durch",
    titleEn: "Critical alerts always get through",
    changes: [
      {
        type: "neu",
        text: "Kritische Meldungen – neuer App-Fehler, Live-Seite nicht erreichbar, Geheimnis im Repository – gehen mit höchster ntfy-Priorität raus und kommen so auch bei „Nicht stören“ durch (in der ntfy-App erlauben). Abschaltbar unter Benachrichtigungen in der ntfy-Kachel",
        en: "Critical alerts – a new app error, the live site down, a secret in the repository – go out with the highest ntfy priority and so get through “Do not disturb” too (allow it in the ntfy app). Can be switched off under Notifications in the ntfy tile",
        link: "/account#benachrichtigungen",
      },
    ],
  },
  {
    version: "0.7.9",
    date: "2026-09-15",
    title: "Team-Seite: Übersicht, Claude, Wünsche, Chat",
    titleEn: "Team page: overview, Claude, wishes, chat",
    changes: [
      {
        type: "neu",
        text: "Jedes Team hat eine eigene Seite (Klick auf den Team-Namen): Mitglieder mit Rollen, Team-Projekte mit offenen Aufgaben und Fehlern, letzte Aktivität – und „Woran arbeitet Claude gerade?“ mit allen Aufgaben, bei denen Claude Bearbeiter ist",
        en: "Every team has its own page (click the team name): members with roles, team projects with open tasks and errors, recent activity – and “What is Claude working on?” with all tasks assigned to Claude",
        link: "/teams",
      },
      {
        type: "neu",
        text: "Team-Chat nur für Mitglieder – z. B. um direkt mit dem Bughunter zu sprechen",
        en: "Team chat for members only – e.g. to talk to the bughunter directly",
      },
      {
        type: "neu",
        text: "Wünsche ans Team: jedes Mitglied bis zu 3 am Tag; wer das Team verwaltet, macht mit einem Klick eine Aufgabe in einem Team-Projekt daraus oder lehnt mit Grund ab – die Person bekommt jeweils eine Meldung",
        en: "Wishes to the team: every member up to 3 a day; whoever manages the team turns one into a task in a team project with one click or declines with a reason – the person gets notified either way",
      },
    ],
  },
  {
    version: "0.7.8",
    date: "2026-09-15",
    title: "Befunde verständlich, Fork-Meldung, Beiträge als Aufgabe",
    titleEn: "Findings explained, fork alerts, posts as tasks",
    changes: [
      {
        type: "neu",
        text: "Repo-Check erklärt jeden Befund in einfacher Sprache – was er bedeutet und wie man ihn behebt – und liefert einen fertigen Prompt für Claude Code zum Kopieren. Umgesetzt wird weiter bei dir, VibeWorks schreibt nichts ins Repository",
        en: "The repo check explains every finding in plain words – what it means and how to fix it – and provides a ready-made prompt for Claude Code to copy. Fixing still happens on your side, VibeWorks writes nothing into the repository",
      },
      {
        type: "neu",
        text: "Fork-Meldung: forkt jemand ein Repository eines Projekts, kommt eine Nachricht mit Link zum Fork – nichts wird kopiert. Neuer Anlass „Fork“ (braucht den Webhook)",
        en: "Fork alert: if someone forks a project's repository, you get a message with a link to the fork – nothing is copied. New event “Fork” (needs the webhook)",
      },
      {
        type: "neu",
        text: "Community: Mitglieder ab „Bearbeiter“ übernehmen einen Beitrag mit einem Klick als Aufgabe (mit Issue, wenn das Projekt spiegelt) – Beiträge anderer bleiben intern",
        en: "Community: members from “Editor” up turn a post into a task with one click (with an issue if the project mirrors) – posts by others stay internal",
      },
      {
        type: "besser",
        text: "MCP-Regeln: die KI fragt vor dem Speichern, in welchem Werkzeug sie läuft und wohin die Regeln sollen",
        en: "MCP rules: the AI asks which tool it runs in and where the rules should go before saving them",
      },
    ],
  },
  {
    version: "0.7.7",
    date: "2026-09-15",
    title: "Brett einstellen, Bearbeiter aus dem Team, neue Benachrichtigungs-Seite",
    titleEn: "Set up the board, assignees from the team, new notification page",
    changes: [
      {
        type: "neu",
        text: "Aufgabenbrett einstellen (Zahnrad): Spalten umbenennen, Reihenfolge ändern, Spalten ausblenden und lange Spalten nach 5, 10, 20 oder 50 Karten einklappen – gilt für alle im Projekt, der Status dahinter bleibt gleich",
        en: "Set up the task board (gear icon): rename columns, change their order, hide columns and collapse long ones after 5, 10, 20 or 50 cards – applies to everyone in the project, the status behind stays the same",
      },
      {
        type: "neu",
        text: "Bearbeiter: Vorschläge aus den Leuten im Projekt (Besitzer, Mitglieder, Teams). Wer eingetragen wird, bekommt eine Meldung in der Glocke – neuer Anlass „Aufgabe zugewiesen“",
        en: "Assignee: suggestions from the people in the project (owner, members, teams). Whoever is entered gets a notification in the bell – new event “Task assigned”",
      },
      {
        type: "besser",
        text: "Benachrichtigungs-Einstellungen neu: Kanäle als Kacheln mit Status, Anlässe nach Themen gruppiert mit Schaltern und „Alle an/aus“",
        en: "Notification settings redesigned: channels as tiles with status, events grouped by topic with switches and “All on/off”",
        link: "/account#benachrichtigungen",
      },
      {
        type: "besser",
        text: "„Neue Aufgabe mit Details“ hat ein eigenes Symbol – das Zahnrad stellt jetzt das Brett ein",
        en: "“New task with details” has its own icon – the gear now sets up the board",
      },
    ],
  },
  {
    version: "0.7.6",
    date: "2026-09-15",
    title: "Bot-Konto für Issues und Rolle „Bughunter“",
    titleEn: "Bot account for issues and “Bughunter” role",
    changes: [
      {
        type: "neu",
        text: "Bot-Konto für Issues: je Git-Verbindung lässt sich der Token eines zweiten Kontos (z. B. „vibeworks-bot“) eintragen – dann legt VibeWorks Issues und Status-Labels unter dem Bot an statt unter deinem Profil. Commits, CI und Import laufen weiter über deinen Zugang",
        en: "Bot account for issues: per Git connection you can enter the token of a second account (e.g. “vibeworks-bot”) – VibeWorks then creates issues and status labels as the bot instead of under your profile. Commits, CI and import keep using your access",
        link: "/account#git-zugang",
      },
      {
        type: "neu",
        text: "Neue Standardrolle „Bughunter“: Aufgaben, Notizen, Zeit, Git- und Live-Prüfung und Fehler-Eingang – ohne Mitglieder, Kosten und Projektangaben. Vergeben im Teilen-Dialog",
        en: "New built-in role “Bughunter”: tasks, notes, time, Git and live checks and the error inbox – without members, costs or project details. Assigned in the share dialog",
      },
    ],
  },
  {
    version: "0.7.5",
    date: "2026-09-15",
    title: "Wer hat's angelegt? Klare MCP-Fehler",
    titleEn: "Who created it? Clear MCP errors",
    changes: [
      {
        type: "neu",
        text: "Aufgaben merken sich, wer sie in VibeWorks angelegt hat – auf der Karte, im Dialog und im Issue („✍️ Erstellt von …“; per KI über MCP und Automatisches werden als solches genannt). Bestehende Aufgaben bekommen den Ersteller aus dem Aktivitätsprotokoll",
        en: "Tasks remember who created them in VibeWorks – on the card, in the dialog and in the issue (“✍️ Erstellt von …”; created by AI via MCP and automatic ones are labelled as such). Existing tasks get their creator from the activity log",
      },
      {
        type: "besser",
        text: "MCP-Fehler 401 nennen die Ursache (missing, malformed, invalid_or_revoked, account_inactive); am Schlüssel steht, von welcher Adresse und mit welchem Programm er zuletzt benutzt wurde, dazu wie lange Schlüssel und Sitzungen gelten",
        en: "MCP 401 errors name the cause (missing, malformed, invalid_or_revoked, account_inactive); each key shows the address and program it was last used from, plus how long keys and sessions last",
        link: "/account#mcp",
      },
      {
        type: "besser",
        text: "Abgelaufene Anmeldung: die Anmeldeseite sagt jetzt, warum, statt stumm zurückzuspringen",
        en: "Expired sign-in: the sign-in page now says why instead of silently jumping back",
      },
      {
        type: "besser",
        text: "„KI & MCP“ steht direkt im Profilmenü",
        en: "“AI & MCP” is right in the profile menu",
      },
      {
        type: "fix",
        text: "Keine CSP-Meldung „eval blockiert“ und keine Schrift-Warnung (Cascadia Code) mehr in der Browser-Konsole",
        en: "No more CSP “eval blocked” message and no font warning (Cascadia Code) in the browser console",
      },
    ],
  },
  {
    version: "0.7.4",
    date: "2026-09-15",
    title: "Hinweise auf Neues und schönere Scrollbars",
    titleEn: "What's new notices and nicer scrollbars",
    changes: [
      {
        type: "neu",
        text: "Nach einem Update meldet die Glocke neue Funktionen in deiner Sprache – ein Klick führt direkt zur passenden Einstellung. Abschaltbar unter Benachrichtigungen („Neue Funktionen“)",
        en: "After an update the bell announces new features in your language – a click takes you straight to the matching setting. Can be switched off under Notifications (“New features”)",
        link: "/account#benachrichtigungen",
      },
      {
        type: "besser",
        text: "Im Änderungsverlauf führt „Ansehen“ bei neuen Funktionen direkt zur Einstellung",
        en: "In the changelog, “View” takes you straight to the setting of a new feature",
      },
      {
        type: "besser",
        text: "Schönere Scrollbars überall – schmal, ohne graue Spur, in den Farben deines Designs und beim Anfassen in der Akzentfarbe; auch in Firefox",
        en: "Nicer scrollbars everywhere – slim, no grey track, in your design's colours and in the accent colour while you drag; in Firefox too",
      },
    ],
  },
  {
    version: "0.7.3",
    date: "2026-09-15",
    title: "MCP: Regeln für KI-Agenten und Protokoll",
    titleEn: "MCP: rules for AI agents and call log",
    changes: [
      {
        type: "neu",
        text: "Regeln für KI-Agenten: Beim ersten Verbinden holt sich die KI mit get_agent_rules eine Skill-Datei (englisch, mit der aktuellen Werkzeugliste), speichert sie lokal – Claude Code, Gemini oder AGENTS.md – und bestätigt mit confirm_agent_rules. Bis dahin erinnert jede Antwort daran; ob bestätigt ist, steht am Schlüssel",
        en: "Rules for AI agents: on first connect the AI fetches a skill file with get_agent_rules (English, with the current tool list), saves it locally – Claude Code, Gemini or AGENTS.md – and confirms with confirm_agent_rules. Until then every answer reminds it; the key shows whether it's confirmed",
        link: "/account#mcp",
      },
      {
        type: "neu",
        text: "MCP-Protokoll im Konto: welche Werkzeuge deine Schlüssel aufgerufen haben, mit Ergebnis, Fehler und Dauer – ohne Inhalte, nach 30 Tagen gelöscht. Am Schlüssel steht außerdem, welcher Client ihn benutzt",
        en: "MCP call log in your account: which tools your keys called, with result, error and duration – without contents, deleted after 30 days. Each key also shows which client uses it",
      },
      {
        type: "besser",
        text: "Ältere MCP-Clients funktionieren weiter, bekommen aber den Hinweis, sich zu aktualisieren; Aufrufe unbekannter Werkzeuge landen im Protokoll",
        en: "Older MCP clients keep working but get a note to update; calls to unknown tools show up in the log",
      },
    ],
  },
  {
    version: "0.7.2",
    date: "2026-09-15",
    title: "Entwürfe und Passwort-Erinnerung",
    titleEn: "Drafts and password reminder",
    changes: [
      {
        type: "neu",
        text: "Angefangene Texte bleiben erhalten, wenn man die Seite verlässt oder neu lädt: neue Aufgabe, neues Projekt, neue Notiz, Community-Beitrag, Antwort und Chat. Hinweis „Entwurf wiederhergestellt · Verwerfen“; beim Abmelden werden alle Entwürfe gelöscht, Anmeldedaten nie gespeichert",
        en: "Unfinished texts survive leaving or reloading the page: new task, new project, new note, community post, reply and chat. Note “Draft restored · Discard”; signing out deletes all drafts, sign-in data is never stored",
      },
      {
        type: "neu",
        text: "Erinnerung zum Passwortwechsel – unter Konto → Passwort einstellbar (aus, 90, 180 oder 365 Tage). Die Meldung kommt über die Glocke und die Kanäle, ein Klick führt direkt zur Einstellung",
        en: "Password change reminder – set under Account → Password (off, 90, 180 or 365 days). It arrives via the bell and your channels, a click takes you straight to the setting",
        link: "/account#passwort",
      },
      {
        type: "besser",
        text: "Strengere Passwortregeln für neue Passwörter: mindestens 12 Zeichen und ein Sonderzeichen (ein Leerzeichen zählt – Passphrasen gehen weiter). Beim Tippen zeigen Häkchen, was schon erfüllt ist; bestehende Passwörter bleiben gültig",
        en: "Stricter rules for new passwords: at least 12 characters and one special character (a space counts – passphrases still work). Checkmarks show what's already met while typing; existing passwords stay valid",
      },
    ],
  },
  {
    version: "0.7.1",
    date: "2026-09-15",
    title: "Glocke und Bearbeiter",
    titleEn: "Bell and assignees",
    changes: [
      {
        type: "neu",
        text: "Glocke in der Kopfleiste: zeigt die neuesten Benachrichtigungen mit Zahl der ungelesenen. Ein Klick öffnet das Ziel, einzeln als gelesen/ungelesen markieren, löschen oder alle auf einmal als gelesen markieren",
        en: "Bell in the top bar: shows the latest notifications with the number of unread ones. A click opens the target; mark single ones read/unread, delete them or mark all as read at once",
      },
      {
        type: "neu",
        text: "Bearbeiter an Aufgaben: wer daran arbeitet (z. B. „anna“ oder „Claude“), steht auf der Karte und im Issue („👤 Bearbeitet von“). Umgekehrt zeigen Zuweisungen im Issue und Labels wie „🤖 Claude“, wer das Issue gerade macht",
        en: "Assignees on tasks: who works on it (e.g. “anna” or “Claude”) shows on the card and in the issue (“👤 Bearbeitet von”). The other way round, issue assignees and labels like “🤖 Claude” show who is working on the issue",
      },
      {
        type: "besser",
        text: "MCP: create_task und update_task kennen „assignee“ – eine KI trägt beim Start ihren Namen ein, damit alle sehen, wer dran ist",
        en: "MCP: create_task and update_task know “assignee” – an AI enters its name when it starts, so everyone sees who is on it",
      },
    ],
  },
  {
    version: "0.7.0",
    date: "2026-09-15",
    title: "Team-Rollen und eigene Rollen",
    titleEn: "Team roles and your own roles",
    changes: [
      {
        type: "neu",
        text: "Team-Rollen mit eigenen Rechten: Mitglieder einladen, Mitglieder entfernen, Rollen im Team vergeben, Team umbenennen und löschen. Standardrollen Admin, Einlader und Mitglied – bisherige Admins und Mitglieder behalten ihre Rechte",
        en: "Team roles with their own permissions: inviting members, removing members, assigning roles in the team, renaming and deleting the team. Built-in roles Admin, Inviter and Member – existing admins and members keep their permissions",
      },
      {
        type: "neu",
        text: "Jedes Team legt seine eigenen Rollen an (Teams → Team → Rollen dieses Teams) – wer „Rollen vergeben“ darf, nur bis zu den eigenen Rechten. In der Mitgliederliste wählt man die Rolle per Auswahlfeld",
        en: "Every team creates its own roles (Teams → team → This team's roles) – whoever may assign roles, only up to their own permissions. In the member list you pick the role from a dropdown",
      },
      {
        type: "neu",
        text: "Eigene Projekt-Rollen direkt im Teilen-Dialog anlegen („Eigene Rolle anlegen“) – sie stehen danach sofort zur Auswahl",
        en: "Create your own project roles right in the share dialog (“Create your own role”) – they're available for selection straight away",
      },
      {
        type: "besser",
        text: "Admins pflegen unter Administration → Rollen jetzt auch Vorlagen für Team-Rollen",
        en: "Under Administration → Roles, admins now also maintain templates for team roles",
      },
      {
        type: "fix",
        text: "Die Versionsanzeige kommt jetzt aus dem Änderungsverlauf – vorher zählten auch die Repo-Check-Commits mit, deshalb stand dort z. B. 0.7.1 statt 0.6.9. „Update Nr.“ zählt weiter alle Commits",
        en: "The version display now comes from the changelog – previously the repo check commits were counted too, which showed e.g. 0.7.1 instead of 0.6.9. “Update no.” still counts all commits",
      },
      {
        type: "fix",
        text: "„Token auf GitHub erstellen“ fragt überall dieselben, vollständigen Rechte an (repo, admin:repo_hook, workflow) – vorher fehlte im Git-Bereich „repo“, damit gingen private Repositories und der Repo-Check nicht",
        en: "“Create token on GitHub” now requests the same complete scopes everywhere (repo, admin:repo_hook, workflow) – previously “repo” was missing in the Git section, so private repositories and the repo check didn't work",
      },
    ],
  },
  {
    version: "0.6.9",
    date: "2026-09-15",
    title: "Rollen",
    titleEn: "Roles",
    changes: [
      {
        type: "neu",
        text: "Rollen statt nur „Ansehen/Bearbeiten“: zehn einzelne Rechte (Aufgaben, Aufgaben löschen, Notizen, Projektangaben, Kosten, Zeit erfassen, Git prüfen, Live-Prüfung, Fehler-Eingang, Mitglieder einladen). Standardrollen: Betrachter, Mitwirkender, Bearbeiter, Manager – bestehende Mitglieder behalten ihre Rechte",
        en: "Roles instead of just “view/edit”: ten individual permissions (tasks, deleting tasks, notes, project details, costs, time tracking, Git checks, live check, error inbox, inviting members). Built-in roles: Viewer, Contributor, Editor, Manager – existing members keep their permissions",
      },
      {
        type: "neu",
        text: "Eigene Rollen im Profilmenü unter Rollen; Admins pflegen Vorlagen für alle und passen die Standardrollen an (Administration → Rollen). Vergeben werden Rollen im Teilen-Dialog – an Mitglieder, bei Anfragen und an Teams",
        en: "Your own roles in the profile menu under Roles; admins maintain templates for everyone and adjust the built-in roles (Administration → Roles). Roles are assigned in the share dialog – to members, on requests and to teams",
      },
      {
        type: "besser",
        text: "Sicherheit: Wer Mitglieder einladen darf, vergibt nur Rollen bis zu den eigenen Rechten und stuft niemanden um, der mehr darf. Öffentlicher Link, Team-Freigaben, Repository, Token und Löschen bleiben immer beim Besitzer; wird eine eigene Rolle gelöscht, bleibt nur Lesen",
        en: "Security: whoever may invite members only assigns roles up to their own permissions and can't change anyone who may do more. Public link, team shares, repository, token and deletion always stay with the owner; if a custom role is deleted, only read access remains",
      },
      {
        type: "besser",
        text: "Zeit erfassen ist jetzt ein eigenes Recht (ab „Mitwirkender“) – Betrachter lesen nur noch",
        en: "Time tracking is now its own permission (from “Contributor” up) – viewers only read",
      },
    ],
  },
  {
    version: "0.6.8",
    date: "2026-09-15",
    title: "Teams",
    titleEn: "Teams",
    changes: [
      {
        type: "neu",
        text: "Teams (Profilmenü → Teams): Konten zu Teams zusammenfassen und Projekte an ein ganzes Team freigeben – zum Ansehen oder Bearbeiten (Projekt → Teilen → Teams). Wer später dazukommt, sieht die Projekte sofort; wer geht oder entfernt wird, verliert den Zugriff sofort",
        en: "Teams (profile menu → Teams): group accounts into teams and share projects with a whole team – to view or edit (project → Share → Teams). Whoever joins later sees the projects right away; whoever leaves or is removed loses access immediately",
      },
      {
        type: "neu",
        text: "Beitritt nur per Einladung, die angenommen werden muss; Team-Admins verwalten Mitglieder, und ein Team behält immer einen Admin. Benachrichtigung bei Einladungen, „Mit mir geteilt“ zeigt „über Team …“",
        en: "Joining only by invitation, which has to be accepted; team admins manage members, and a team always keeps an admin. Notification for invitations, “Shared with me” shows “via team …”",
      },
      {
        type: "besser",
        text: "Sicherheit: Freigeben darf nur der Projektbesitzer und nur an Teams, in denen er selbst ist; Löschen, Teilen und Token bleiben beim Besitzer. Ist jemand zusätzlich einzeln eingeladen, gilt die stärkere Rolle. Nur im Mehrbenutzerbetrieb",
        en: "Security: only the project owner can share, and only with teams they belong to; deleting, sharing and tokens stay with the owner. If someone is also invited individually, the stronger role applies. Multi-user mode only",
      },
    ],
  },
  {
    version: "0.6.7",
    date: "2026-09-15",
    title: "Vorstellungs-Folien",
    titleEn: "Presentation slides",
    changes: [
      {
        type: "neu",
        text: "Projekt präsentieren: Im Projekt über das Menü „Weitere Aktionen“ → Präsentieren baut VibeWorks Folien aus deinen Angaben – Titel, je Überschrift der Beschreibung eine Folie, Stand mit Aufgaben, letzte Commits, Live-Seite, nächste Schritte und ein Schluss mit Links",
        en: "Present a project: in a project via the “More actions” menu → Present, VibeWorks builds slides from your details – title, one slide per heading of the description, status with tasks, recent commits, live site, next steps and a closing slide with links",
      },
      {
        type: "neu",
        text: "Blättern mit Pfeiltasten, Leertaste, Klick oder Wischen, F für Vollbild, Esc zurück – in den Farben des Projekts, passend zu Hell und Dunkel. Nur für Projektmitglieder",
        en: "Navigate with arrow keys, space, click or swipe, F for fullscreen, Esc to go back – in the project's colors, fitting light and dark mode. Only for project members",
      },
    ],
  },
  {
    version: "0.6.6",
    date: "2026-09-15",
    title: "Community-Chat",
    titleEn: "Community chat",
    changes: [
      {
        type: "neu",
        text: "Chat in der Community: ein Lobby-Chat für alle auf der Instanz und ein Chat je vorgestelltem Projekt. Neue Nachrichten erscheinen von selbst, Enter sendet",
        en: "Chat in the community: a lobby chat for everyone on the instance and a chat for each presented project. New messages show up by themselves, Enter sends",
      },
      {
        type: "neu",
        text: "Moderation wie bei den Beiträgen: Nachrichten ausblenden, löschen und melden; im Projekt-Chat moderiert der Besitzer, in der Lobby die Admins. Gemeldete Nachrichten stehen in Administration → Community, Sperren gelten auch im Chat",
        en: "Moderation like for posts: hide, delete and report messages; the owner moderates the project chat, admins moderate the lobby. Reported messages show up under Administration → Community, bans apply to the chat too",
      },
      {
        type: "besser",
        text: "Sicherheit: Chat-Nachrichten werden als reiner Text gezeigt (kein HTML, kein Markdown), höchstens 1.000 Zeichen und 20 Nachrichten je Minute",
        en: "Security: chat messages are shown as plain text (no HTML, no Markdown), at most 1,000 characters and 20 messages per minute",
      },
    ],
  },
  {
    version: "0.6.5",
    date: "2026-09-15",
    title: "Community",
    titleEn: "Community",
    changes: [
      {
        type: "neu",
        text: "Community für die Konten deiner Instanz (Mehrbenutzerbetrieb): Projekte vorstellen und dazu Fragen, Ideen und Fehlerberichte schreiben, mit Antworten und Markdown. Antwortet der Projektbesitzer auf eine Frage, gilt sie als beantwortet",
        en: "Community for the accounts of your instance (multi-user mode): present projects and write questions, ideas and bug reports about them, with replies and Markdown. When the project owner answers a question, it counts as answered",
      },
      {
        type: "neu",
        text: "Moderation: Der Projektbesitzer kann Beiträge ausblenden, schließen, löschen und Leute für sein Projekt sperren; alle können melden. Admins sehen unter Administration → Community alle Meldungen und können Konten für die ganze Community sperren",
        en: "Moderation: the project owner can hide, close and delete posts and ban people from their project; everyone can report. Admins see all reports under Administration → Community and can ban accounts from the whole community",
      },
      {
        type: "neu",
        text: "Benachrichtigung bei neuen Beiträgen zu deinem Projekt und bei Antworten auf deine Beiträge",
        en: "Notifications for new posts on your project and for replies to your posts",
      },
      {
        type: "besser",
        text: "Datenschutz: Die Community zeigt nur Name, Kurzbeschreibung, Stand, Tags und Links der Projekte, die du ausdrücklich freigibst – Beschreibung, Notizen und Aufgaben bleiben privat, und niemand bekommt dadurch Zugriff auf das Projekt. Ausgeblendetes sehen nur Autor und Moderation; Gesperrte können lesen, aber nicht schreiben",
        en: "Privacy: the community only shows name, summary, status, tags and links of projects you explicitly share – description, notes and tasks stay private, and nobody gets access to the project through it. Hidden posts are only visible to their author and moderators; banned people can read but not write",
      },
    ],
  },
  {
    version: "0.6.4",
    date: "2026-09-15",
    title: "Einladungslinks",
    titleEn: "Invitation links",
    changes: [
      {
        type: "neu",
        text: "Einladungslinks: Unter Administration → Einladungen erzeugst du Links für neue Konten – einmal nutzbar, 1, 7 oder 30 Tage gültig, mit Notiz. Sie funktionieren auch, wenn die Selbstregistrierung aus ist; so kommen Leute gezielt in deine Instanz (Grundlage für die Community)",
        en: "Invitation links: under Administration → Invitations you create links for new accounts – single use, valid for 1, 7 or 30 days, with a note. They work even when self-registration is off, so you can bring people into your instance on purpose (the basis for the community)",
      },
      {
        type: "besser",
        text: "Sicherheit: VibeWorks speichert vom Link nur einen Fingerabdruck und zeigt ihn nur beim Erzeugen; Einlösen und Konto anlegen geschehen in einem Schritt (zweimal geht nicht, ein vergebener Name verbraucht die Einladung nicht). Eingeladene bekommen immer ein normales Benutzerkonto, offene Links lassen sich zurückziehen",
        en: "Security: VibeWorks only stores a fingerprint of the link and shows it only when creating it; redeeming and creating the account happen in one step (no second use, a taken username doesn't use up the invitation). Invited people always get a regular user account, open links can be revoked",
      },
    ],
  },
  {
    version: "0.6.3",
    date: "2026-09-15",
    title: "Fehler-Eingang",
    titleEn: "Error inbox",
    changes: [
      {
        type: "neu",
        text: "Fehler-Eingang: Deine Apps melden Laufzeitfehler direkt an VibeWorks – mit fertigen Schnipseln für Browser, Node.js und Skripte. Gleichartige Fehler werden zusammengefasst (auch über neue Builds hinweg), mit Zähler, Stack und Version",
        en: "Error inbox: your apps report runtime errors straight to VibeWorks – with ready-made snippets for browser, Node.js and scripts. Similar errors are grouped (even across new builds), with count, stack and version",
      },
      {
        type: "neu",
        text: "Erledigen, Ignorieren oder als Aufgabe übernehmen; ein erledigter Fehler, der wiederkommt, ist wieder offen. Neue Fehler melden sich als Benachrichtigung (höchstens 5 je Stunde und Projekt)",
        en: "Resolve, ignore or turn into a task; a resolved error that comes back is open again. New errors notify you (at most 5 per hour and project)",
      },
      {
        type: "neu",
        text: "Claude kann die Fehler lesen und abhaken: list_errors und resolve_error; list_problems zeigt offene Fehler aller Projekte",
        en: "Claude can read and tick off errors: list_errors and resolve_error; list_problems shows open errors across all projects",
      },
      {
        type: "besser",
        text: "Sicherheit: Der Schlüssel in der Adresse erlaubt nur, Fehler in dieses eine Projekt zu schreiben – ohne Cookies, mit Größen- und Mengenlimits, jederzeit erneuerbar. Details sehen nur Projektmitglieder, und eine Aufgabe aus einem Fehler enthält keinen Stack und keine Seiten-Adresse (sie kann als Issue öffentlich werden)",
        en: "Security: the key in the address only allows writing errors into this one project – no cookies, with size and rate limits, renewable any time. Only project members see details, and a task made from an error contains no stack and no page address (it may become a public issue)",
      },
    ],
  },
  {
    version: "0.6.2",
    date: "2026-09-15",
    title: "Repo-Check und Abhängigkeiten als Aufgaben",
    titleEn: "Repo check and dependencies as tasks",
    changes: [
      {
        type: "neu",
        text: "Repo-Check ohne KI: VibeWorks richtet in GitHub-Repositories einen kostenlosen Workflow ein, der Geheimnisse (Gitleaks), Sicherheitslücken (OSV-Scanner), Fehlermuster (Semgrep) und TODOs findet – Ergebnis mit Links auf die Fundstellen, montags und auf Knopfdruck",
        en: "Repo check without AI: VibeWorks sets up a free workflow in GitHub repositories that finds secrets (Gitleaks), vulnerabilities (OSV-Scanner), bug patterns (Semgrep) and TODOs – results link to the exact spot, on Mondays and on demand",
      },
      {
        type: "neu",
        text: "Was im Abhängigkeiten-Check markiert ist, steht sofort als Aufgabe im Board – eine für Sicherheitslücken, eine für Updates; die Liste pflegt sich selbst und die Aufgabe ist erledigt, sobald nichts mehr markiert ist",
        en: "Whatever the dependency check flags shows up as a task on the board right away – one for vulnerabilities, one for updates; the list keeps itself up to date and the task is done once nothing is flagged",
      },
      {
        type: "neu",
        text: "Benachrichtigung, wenn der Repo-Check neue Geheimnisse oder Lücken findet; der Check fließt in die Wochen-Vorschläge und in Claudes get_repo_status/list_problems ein",
        en: "Notification when the repo check finds new secrets or vulnerabilities; the check also feeds the weekly suggestions and Claude's get_repo_status/list_problems",
      },
      {
        type: "besser",
        text: "Sicherheit: Die Ergebnisse sehen nur Projektmitglieder, nie öffentliche Seiten; der Workflow hat nur Leserechte und gibt sein Token nicht an die Prüfwerkzeuge weiter. Ausschalten nimmt die Datei wieder aus dem Repository, und wer sie dort löscht, schaltet den Check ab",
        en: "Security: only project members see the results, never public pages; the workflow is read-only and doesn't hand its token to the scanners. Turning it off removes the file from the repository again, and deleting it there turns the check off",
      },
      {
        type: "fix",
        text: "Abhängigkeiten-Check: Markiert ein Paket einen Release Candidate als „latest“ (z. B. prisma 8.0.0-rc), zählt jetzt die höchste stabile Version",
        en: "Dependency check: if a package tags a release candidate as “latest” (e.g. prisma 8.0.0-rc), the highest stable version now counts",
      },
      {
        type: "besser",
        text: "Der GitHub-Token-Link fragt jetzt auch das Recht „workflow“ an (für den Repo-Check)",
        en: "The GitHub token link now also asks for the “workflow” scope (for the repo check)",
      },
    ],
  },
  {
    version: "0.6.1",
    date: "2026-09-15",
    title: "Sicherheits-Nachtrag zu Prisma 7",
    titleEn: "Security follow-up to Prisma 7",
    changes: [
      {
        type: "fix",
        text: "Die Prisma-Werkzeuge brachten eine veraltete MySQL-Bibliothek mit bekannten Lücken mit – jetzt auf die abgesicherte Version angehoben (VibeWorks nutzt MySQL nicht, npm audit meldet wieder keine Lücken)",
        en: "The Prisma tooling shipped an outdated MySQL library with known vulnerabilities – now raised to the patched version (VibeWorks doesn't use MySQL; npm audit reports no vulnerabilities again)",
      },
    ],
  },
  {
    version: "0.6.0",
    date: "2026-09-15",
    title: "Prisma 7",
    titleEn: "Prisma 7",
    changes: [
      {
        type: "besser",
        text: "Die Datenbank-Anbindung läuft auf Prisma 7 – ohne eigene Query-Engine, direkt über den Postgres-Treiber: schlankere Installation, schnellerer Start",
        en: "The database layer runs on Prisma 7 – no separate query engine, straight through the Postgres driver: leaner install, faster startup",
      },
      {
        type: "besser",
        text: "Alle Abhängigkeiten sind jetzt aktuell (Next.js 16, zod 4, Prisma 7, SimpleWebAuthn 14) – npm audit meldet keine Lücken",
        en: "All dependencies are now up to date (Next.js 16, zod 4, Prisma 7, SimpleWebAuthn 14) – npm audit reports no vulnerabilities",
      },
    ],
  },
  {
    version: "0.5.9",
    date: "2026-09-15",
    title: "zod 4",
    titleEn: "zod 4",
    changes: [
      {
        type: "besser",
        text: "Die Eingabeprüfung läuft auf zod 4 – schneller, Fehlermeldungen unverändert auf Deutsch und Englisch",
        en: "Input validation runs on zod 4 – faster, error messages unchanged in German and English",
      },
      {
        type: "fix",
        text: "Abgesichert: Änderungen an Projekten und Prompts übernehmen nur die geschickten Felder – zod 4 hätte beim Umbenennen sonst Status, Fortschritt und Tags zurückgesetzt",
        en: "Safeguarded: changes to projects and prompts only take the fields that were sent – zod 4 would otherwise have reset status, progress and tags when renaming",
      },
    ],
  },
  {
    version: "0.5.8",
    date: "2026-09-15",
    title: "Next.js 16",
    titleEn: "Next.js 16",
    changes: [
      {
        type: "besser",
        text: "VibeWorks läuft auf Next.js 16 – gebaut mit Turbopack; die Middleware heißt jetzt Proxy und läuft auf Node.js",
        en: "VibeWorks runs on Next.js 16 – built with Turbopack; the middleware is now called proxy and runs on Node.js",
      },
    ],
  },
  {
    version: "0.5.7",
    date: "2026-09-15",
    title: "Sicherheits-Update der Abhängigkeiten",
    titleEn: "Dependency security update",
    changes: [
      {
        type: "fix",
        text: "Fünf bekannte Sicherheitslücken behoben (PostCSS in Next.js, deepmerge-ts im Prisma-Werkzeug) – npm audit meldet keine mehr",
        en: "Fixed five known vulnerabilities (PostCSS in Next.js, deepmerge-ts in the Prisma tooling) – npm audit reports none",
      },
      {
        type: "besser",
        text: "Passkeys auf SimpleWebAuthn 14, dazu nodemailer und die Node-Typen aktualisiert; VibeWorks braucht jetzt Node.js 22 oder neuer (der Installer richtet 24 ein)",
        en: "Passkeys on SimpleWebAuthn 14, plus updated nodemailer and Node types; VibeWorks now needs Node.js 22 or newer (the installer sets up 24)",
      },
    ],
  },
  {
    version: "0.5.6",
    date: "2026-09-15",
    title: "Wochen-Vorschläge",
    titleEn: "Weekly suggestions",
    changes: [
      {
        type: "neu",
        text: "Jede Woche bis zu fünf Vorschläge auf dem Dashboard – aus deinen Projekten, ohne KI: Sicherheitslücken, rote CI, Git-Fehler, Verlängerungen, Überfälliges, schlafende Projekte, große Updates, fehlende Planung",
        en: "Up to five suggestions on the dashboard every week – from your projects, no AI: vulnerabilities, red CI, Git errors, renewals, overdue tasks, sleeping projects, major updates, missing planning",
      },
      {
        type: "neu",
        text: "Annehmen legt eine Aufgabe an, merkt Überfälliges für heute vor oder heißt „weitermachen“; Abgelehntes kommt drei Wochen nicht wieder",
        en: "Accepting creates a task, puts overdue tasks on today's list or means “carry on”; dismissed ones stay away for three weeks",
      },
      {
        type: "neu",
        text: "Benachrichtigung „Vorschläge für diese Woche“ montags ab 8 Uhr",
        en: "“Suggestions for this week” notification on Mondays from 8 am",
      },
    ],
  },
  {
    version: "0.5.5",
    date: "2026-09-15",
    title: "Besseres MCP",
    titleEn: "Better MCP",
    changes: [
      {
        type: "neu",
        text: "Neue Werkzeuge für Claude: get_repo_status (Commits, CI, Abhängigkeiten, Live-Seite), list_problems (alles, was klemmt), Heute planen und Zeit erfassen",
        en: "New tools for Claude: get_repo_status (commits, CI, dependencies, live site), list_problems (everything that needs attention), planning today and tracking time",
      },
      {
        type: "neu",
        text: "Deine Prompt-Bibliothek erscheint in Claude Code als Befehle, auf Wunsch mit einem Projekt ausgefüllt",
        en: "Your prompt library shows up in Claude Code as commands, optionally filled in with a project",
      },
      {
        type: "neu",
        text: "Die CLAUDE.md jedes Projekts, „Was klemmt“ und „Heute“ lassen sich in Claude Code als Ressourcen anhängen",
        en: "Every project's CLAUDE.md, “problems” and “today” can be attached as resources in Claude Code",
      },
    ],
  },
  {
    version: "0.5.4",
    date: "2026-09-15",
    title: "Stern-Schutz",
    titleEn: "Star protection",
    changes: [
      {
        type: "neu",
        text: "Projekte mit Stern sind geschützt: Löschen und Begraben geht erst, wenn der Stern weg ist – auch in der Mehrfachauswahl",
        en: "Starred projects are protected: deleting and burying only works once the star is removed – in multi-select too",
      },
      {
        type: "neu",
        text: "Status und Repository geschützter Projekte ändern sich nur nach Bestätigung – im Dialog, auf der Karte und beim Ziehen im Kanban; Claude (MCP) darf sie gar nicht ändern",
        en: "Status and repository of protected projects only change after confirmation – in the dialog, on the card and when dragging in kanban; Claude (MCP) can't change them at all",
      },
      {
        type: "neu",
        text: "Der Friedhof fragt bei Projekten mit Stern nicht mehr nach",
        en: "The graveyard no longer asks about starred projects",
      },
      {
        type: "besser",
        text: "Fehlermeldungen im Projekt-Dialog stehen jetzt direkt über den Knöpfen statt am Ende des Formulars",
        en: "Error messages in the project dialog now appear right above the buttons instead of at the end of the form",
      },
    ],
  },
  {
    version: "0.5.3",
    date: "2026-09-14",
    title: "Repositories automatisch, jeder Git-Server",
    titleEn: "Automatic repositories, any Git server",
    changes: [
      {
        type: "neu",
        text: "Git-Verbindungen legen für jedes eigene Repository selbst ein Projekt an – beim Verbinden und alle 30 Minuten für neue (ohne Forks und archivierte; gelöschte kommen nicht wieder)",
        en: "Git connections create a project for every repository you own – when connecting and every 30 minutes for new ones (no forks or archived ones; deleted ones don't come back)",
      },
      {
        type: "neu",
        text: "Beliebiger Git-Server als Verbindung: Commits und Abhängigkeiten direkt per git, Zugang als benutzer:token – unbekannte Server ohne API gehen automatisch diesen Weg",
        en: "Any Git server as a connection: commits and dependencies fetched directly with git, access as user:token – unknown servers without an API take this route automatically",
      },
      {
        type: "neu",
        text: "Git-Fehler sichtbar: bei der Verbindung, als rotes Symbol auf der Projektkarte, als Hinweis auf dem Dashboard und als Benachrichtigung „Git-Abgleich scheitert“",
        en: "Git errors visible: at the connection, as a red icon on the project card, as a notice on the dashboard and as a “Git sync failing” notification",
      },
    ],
  },
  {
    version: "0.5.2",
    date: "2026-09-13",
    title: "Demo-Modus",
    titleEn: "Demo mode",
    changes: [
      {
        type: "neu",
        text: "Demo-Instanz mit DEMO_MODE=true: Besucher kommen mit „Demo ansehen“ ohne Passwort hinein, alles ist schreibgeschützt, Beispielprojekte entstehen von selbst und jede Nacht neu",
        en: "Demo instance with DEMO_MODE=true: visitors get in with “Open the demo” without a password, everything is read-only, sample projects are created automatically and afresh every night",
      },
      {
        type: "neu",
        text: "Der Proxmox-Installer bietet „Demo-Instanz“ als dritte Wahl (oder VIBEWORKS_DEMO=1)",
        en: "The Proxmox installer offers “Demo-Instanz” as a third choice (or VIBEWORKS_DEMO=1)",
      },
    ],
  },
  {
    version: "0.5.1",
    date: "2026-09-13",
    title: "Vorführ-GIF",
    titleEn: "Demo GIF",
    changes: [
      {
        type: "neu",
        text: "Kurze Vorführung im README und auf der Webseite: Aufgabe per Schnellerfassung → Issue → Claude Code arbeitet sie über MCP ab → erledigt",
        en: "A short demo in the README and on the website: task via quick capture → issue → Claude Code works through it via MCP → done",
      },
    ],
  },
  {
    version: "0.5.0",
    date: "2026-09-13",
    title: "Webseite & Doku",
    titleEn: "Website & docs",
    changes: [
      {
        type: "neu",
        text: "VibeWorks hat eine eigene Webseite: moinmornhart.github.io/vibeworks – mit Installationsbefehl zum Kopieren, allen Funktionen und Screenshots",
        en: "VibeWorks has its own website: moinmornhart.github.io/vibeworks – with a copyable install command, all features and screenshots",
      },
      {
        type: "neu",
        text: "Doku auf Deutsch und Englisch: Installation, Git & Issues, Claude Code, Windows-App und alle Funktionen",
        en: "Docs in German and English: installation, Git & issues, Claude Code, Windows app and all features",
      },
    ],
  },
  {
    version: "0.4.9",
    date: "2026-09-13",
    title: "Öffentliches Portfolio",
    titleEn: "Public portfolio",
    changes: [
      {
        type: "neu",
        text: "Mein Konto → Öffentliches Portfolio: einschalten, ein paar Sätze über dich schreiben, Projekte auswählen – die Seite /u/<name> zeigt sie ohne Anmeldung mit Stand, Tags und Links (Live, Code, Details)",
        en: "My account → Public portfolio: switch it on, write a few lines about yourself, pick projects – the page /u/<name> shows them without signing in, with status, tags and links (live, code, details)",
      },
      {
        type: "neu",
        text: "Ausgeschaltet gibt es die Seite nicht; Notizen, Aufgaben und alles andere bleiben privat",
        en: "When switched off, the page doesn't exist; notes, tasks and everything else stay private",
      },
    ],
  },
  {
    version: "0.4.8",
    date: "2026-09-12",
    title: "Ideen-Eingang",
    titleEn: "Idea inbox",
    changes: [
      {
        type: "neu",
        text: "Ideen-Eingang (/inbox): Einfälle erst sammeln, später als Projekt anlegen, als Aufgabe anhängen oder verwerfen – mit Hinweis auf dem Dashboard",
        en: "Idea inbox (/inbox): collect ideas first, later create a project, attach them as a task or discard them – with a hint on the dashboard",
      },
      {
        type: "neu",
        text: "Drei Wege hinein: „Teilen“ vom Handy (VibeWorks zum Startbildschirm hinzufügen), eine geheime Einwurf-Adresse für Kurzbefehle, Tasker oder Mail-Weiterleitungen, und ein ntfy-Thema, das jede Minute abgeholt wird",
        en: "Three ways in: “Share” on your phone (add VibeWorks to your home screen), a secret drop address for Shortcuts, Tasker or mail forwarding, and an ntfy topic fetched every minute",
      },
      {
        type: "besser",
        text: "Profilmenü: Ideen-Eingang und Kosten sind jetzt direkt erreichbar",
        en: "Profile menu: idea inbox and costs are now one click away",
      },
    ],
  },
  {
    version: "0.4.7",
    date: "2026-09-12",
    title: "Abhängigkeiten-Check",
    titleEn: "Dependency check",
    changes: [
      {
        type: "neu",
        text: "Projektseite → Abhängigkeiten: liest die package.json aus dem Repository, vergleicht mit der neuesten Version bei npm (Major, Minor, Patch) und zeigt bekannte Sicherheitslücken – dieselbe Quelle wie „npm audit“",
        en: "Project page → Dependencies: reads package.json from the repository, compares with the latest npm version (major, minor, patch) and shows known vulnerabilities – the same source as “npm audit”",
      },
      {
        type: "neu",
        text: "Geprüft wird einmal am Tag beim Git-Abgleich oder sofort mit „Jetzt prüfen“; Sicherheitswarnungen stehen oben",
        en: "Checked once a day during the Git sync or right away with “Check now”; security advisories come first",
      },
      {
        type: "besser",
        text: "Heute: keine Obergrenze mehr – so viele Aufgaben vormerken, wie du willst",
        en: "Today: no upper limit any more – plan as many tasks as you like",
      },
      {
        type: "fix",
        text: "Navigation aufgeräumt: „Design“ und „Admin“ sind ins Profilmenü gewandert – so passt die Leiste auch mit laufendem Timer vollständig",
        en: "Tidier navigation: “Design” and “Admin” moved into the profile menu – so the bar fits completely even with a running timer",
      },
    ],
  },
  {
    version: "0.4.6",
    date: "2026-09-12",
    title: "Zeiterfassung & Fokus-Timer",
    titleEn: "Time tracking & focus timer",
    changes: [
      {
        type: "neu",
        text: "Timer an jeder Aufgabe (Aufgabenliste, Heute): läuft oben in der Navigation und im Tab-Titel mit, ein Klick stoppt; ein neuer Start beendet den alten",
        en: "Timer on every task (task list, Today): it runs in the navigation and the tab title, one click stops it; starting a new one ends the old one",
      },
      {
        type: "neu",
        text: "Fokus-Timer: 25 Minuten herunterzählen, danach „Fokus geschafft – Pause!“",
        en: "Focus timer: counts down 25 minutes, then “Focus done – take a break!”",
      },
      {
        type: "neu",
        text: "Erfasste Zeit im Projektkopf, auf der Heute-Seite und je Projekt im Wochenrückblick; vergessene Timer zählen höchstens zwölf Stunden",
        en: "Tracked time in the project header, on the Today page and per project in the weekly review; forgotten timers count at most twelve hours",
      },
    ],
  },
  {
    version: "0.4.5",
    date: "2026-09-12",
    title: "Kosten je Projekt",
    titleEn: "Costs per project",
    changes: [
      {
        type: "neu",
        text: "Projektseite → Kosten: Hosting, Domain, KI-API & Co. monatlich, jährlich oder einmalig eintragen, mit Summen pro Monat und Jahr",
        en: "Project page → Costs: add hosting, domain, AI APIs & co. monthly, yearly or one-off, with totals per month and year",
      },
      {
        type: "neu",
        text: "Übersicht /costs: alle Kosten je Währung, anstehende Verlängerungen der nächsten 60 Tage und je Projekt",
        en: "Overview /costs: all costs per currency, renewals in the next 60 days and per project",
      },
      {
        type: "neu",
        text: "Zwei Wochen vor einer Verlängerung (z. B. Domain) kommt eine Benachrichtigung; vergangene Termine rücken von selbst weiter",
        en: "Two weeks before a renewal (e.g. a domain) you get a notification; past dates move on by themselves",
      },
    ],
  },
  {
    version: "0.4.4",
    date: "2026-09-12",
    title: "Prompt-Bibliothek & CLAUDE.md",
    titleEn: "Prompt library & CLAUDE.md",
    changes: [
      {
        type: "neu",
        text: "Prompts: bewährte Anweisungen sammeln, durchsuchen und kopieren – Platzhalter wie {{projekt}}, {{repo}} und {{live}} füllt ein gewähltes Projekt aus; fünf Beispiele zum Start",
        en: "Prompts: collect, search and copy proven instructions – placeholders like {{project}}, {{repo}} and {{live}} are filled in by a chosen project; five examples to start with",
      },
      {
        type: "neu",
        text: "Projekt → Mehr → „CLAUDE.md erzeugen“: Beschreibung, Stand, offene Aufgaben, angepinnte Notizen und die Arbeitsweise mit VibeWorks – anpassen, kopieren oder herunterladen",
        en: "Project → More → “Generate CLAUDE.md”: description, status, open tasks, pinned notes and the VibeWorks workflow – adjust, copy or download",
      },
      {
        type: "neu",
        text: "Für Claude: MCP-Werkzeuge get_claude_md, list_prompts und get_prompt",
        en: "For Claude: MCP tools get_claude_md, list_prompts and get_prompt",
      },
      {
        type: "neu",
        text: "Schnellerfassung (Blitz, Strg+Alt+V in der Windows-App): eine Aufgabe auf einmal in „Alle Projekte“ oder „Alle mit Git“ legen",
        en: "Quick capture (lightning, Ctrl+Alt+V in the Windows app): put a task into “All projects” or “All with Git” at once",
      },
    ],
  },
  {
    version: "0.4.3",
    date: "2026-09-12",
    title: "Heute-Ansicht, Aktivität & Erfolge",
    titleEn: "Today view, activity & achievements",
    changes: [
      {
        type: "neu",
        text: "„Heute“: bis zu fünf Aufgaben aus allen Projekten für den Tag vormerken, abhaken, dazu Vorschläge (überfällig, heute fällig, in Arbeit) – vormerken auch per Sonne in der Aufgabenliste",
        en: "“Today”: plan up to five tasks from all projects for the day and check them off, with suggestions (overdue, due today, in progress) – also via the sun in the task list",
      },
      {
        type: "neu",
        text: "Rückblick: Aktivitätsgitter über das letzte Jahr aus Verlauf und Commits, aktuelle und längste Serie",
        en: "Review: activity grid over the last year from your history and commits, current and longest streak",
      },
      {
        type: "neu",
        text: "Elf kleine Erfolge – von „Erste Idee“ über „Serienheld“ bis „Friedhofsgärtner“ – mit Fortschrittsanzeige",
        en: "Eleven small achievements – from “First idea” to “Streak hero” and “Graveyard keeper” – with progress bars",
      },
      {
        type: "besser",
        text: "Projektkarten wieder ohne Titelbild – der Farbstreifen oben sitzt sauber am Rand; schon geholte Vorschaubilder werden aufgeräumt",
        en: "Project cards without a cover image again – the colour strip at the top sits cleanly on the edge; previously fetched previews are cleaned up",
      },
    ],
  },
  {
    version: "0.4.2",
    date: "2026-09-12",
    title: "Projekt-Friedhof",
    titleEn: "Project graveyard",
    changes: [
      {
        type: "neu",
        text: "Projekte ohne Änderung und Commit seit 30 Tagen erscheinen auf dem Dashboard: weitermachen, später fragen oder begraben",
        en: "Projects without a change or commit for 30 days show up on the dashboard: carry on, ask later or bury",
      },
      {
        type: "neu",
        text: "Begraben mit Todesursache und letzten Worten – der Friedhof zeigt Grabsteine mit Lebensdauer, Aufgaben, Commits und Notizen",
        en: "Bury with a cause of death and last words – the graveyard shows tombstones with lifespan, tasks, commits and notes",
      },
      {
        type: "neu",
        text: "Wiederbeleben holt ein Projekt mit seinem alten Status zurück; nichts geht beim Begraben verloren",
        en: "Bringing a project back restores its old status; nothing is lost when burying",
      },
    ],
  },
  {
    version: "0.4.1",
    date: "2026-09-12",
    title: "Live-Überwachung",
    titleEn: "Live monitoring",
    changes: [
      {
        type: "neu",
        text: "Live-Adresse am Projekt: VibeWorks prüft die fertige Seite alle 5 Minuten – Online/Offline, Antwortzeit, Erreichbarkeit über 24 Stunden, 7 und 30 Tage, 30-Tage-Balken und „Jetzt prüfen“",
        en: "Live address on a project: VibeWorks checks the finished site every 5 minutes – online/offline, response time, uptime over 24 hours, 7 and 30 days, a 30-day bar and “Check now”",
      },
      {
        type: "neu",
        text: "Benachrichtigung, wenn eine Seite ausfällt (erst nach zwei Fehlversuchen), wieder da ist oder ihr SSL-Zertifikat in 14 bzw. 3 Tagen abläuft",
        en: "Notification when a site goes down (only after two failed checks), comes back or its SSL certificate expires in 14 or 3 days",
      },
      {
        type: "neu",
        text: "Das Vorschaubild der Seite (og:image, sonst Icon) wird zum Titelbild der Projektkarte, dazu ein Globus in der Farbe des Zustands",
        en: "The site's preview image (og:image, otherwise its icon) becomes the project card's cover, plus a globe in the colour of the current state",
      },
    ],
  },
  {
    version: "0.4.0",
    date: "2026-09-11",
    title: "Fortschritt per Analyse, Aufgaben für mehrere Projekte",
    titleEn: "Progress by analysis, tasks for several projects",
    changes: [
      {
        type: "neu",
        text: "„Fortschritt automatisch bestimmen“ analysiert jetzt Aufgaben (in Arbeit zählt halb), Commits, CI und Planung; der Status setzt den Rahmen – „Wie berechnet?“ im Projektkopf zeigt die Bestandteile",
        en: "“Determine progress automatically” now analyzes tasks (in progress counts half), commits, CI and planning; the status sets the limits – “How is it calculated?” in the project header shows the parts",
      },
      {
        type: "neu",
        text: "Aufgaben → „Für mehrere Projekte“: dieselbe Aufgabe in vielen Projekten anlegen, alle mit Git sind vorausgewählt – für Claude als MCP-Werkzeug create_task_in_projects",
        en: "Tasks → “For several projects”: create the same task in many projects, all linked to Git are preselected – for Claude as the MCP tool create_task_in_projects",
      },
    ],
  },
  {
    version: "0.3.9",
    date: "2026-09-11",
    title: "VibeWorks für Windows",
    titleEn: "VibeWorks for Windows",
    changes: [
      {
        type: "neu",
        text: "Windows-App zum Herunterladen: eigenes Fenster, Tray neben der Uhr, Schnellerfassung mit Strg+Alt+V aus jedem Programm und automatische Updates",
        en: "Windows app to download: its own window, tray next to the clock, quick capture with Ctrl+Alt+V from any program and automatic updates",
      },
      {
        type: "neu",
        text: "Benachrichtigungen kommen in der Windows-App als Windows-Meldung – der Test-Knopf funktioniert jetzt auch ganz ohne ntfy, Webhook oder E-Mail",
        en: "Notifications show up in the Windows app as Windows notifications – the test button now also works without ntfy, webhook or email",
      },
      {
        type: "neu",
        text: "Schnellerfassung als eigene Seite (/capture) für das kleine Fenster der App",
        en: "Quick capture as its own page (/capture) for the app's small window",
      },
    ],
  },
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
