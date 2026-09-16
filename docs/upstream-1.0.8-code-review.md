# Upstream 1.0.8 code review - branch and commit documentation

Fork: JONIMONI09/vibeworks (issues disabled by design). Base state before sync: ce21d36 (0.7.2). After fast-forward: d88ce45 (1.0.8 = upstream/main). Local commits: 0, upstream commits absorbed: 36. Review branch: analysis/1.0.8-code-review.

## Quality gates (verified on this branch, 2026-09-16)
- typecheck (tsc --noEmit): exit 0
- tests (vitest run): 69 test files / 376 tests, all passed (~3.9 s)
- npm audit --omit=dev: 0 vulnerabilities
- Tool research: Knip recommended next step (unused exports/files/deps detection); web search was credit-blocked, tool facts verified via direct doc fetch

## Branches
```
* analysis/1.0.8-code-review
  main
  remotes/origin/HEAD -> origin/main
  remotes/origin/main
  remotes/upstream/main
```

## Commits (oldest first, full descriptions for review)

### 1. ce26eb65c - MCP: Regeln für KI-Agenten und Protokoll (0.7.3)

- get_agent_rules liefert eine Skill-Datei (englisch, Frontmatter, aktuelle Werkzeugliste) zum lokalen Speichern; confirm_agent_rules bestätigt – bis dahin hängt an jeder Antwort ein Hinweis (alte Clients laufen weiter) - Protokoll-Haken: onInitialize (Client/Version am Schlüssel), onToolCall (McpCall: Werkzeug, Ergebnis, Dauer, Fehlertext – ohne Eingaben, 30 Tage), notice; veraltete Protokollversion bekommt einen Update-Hinweis - Konto: Status „Regeln bestätigt“ und Client je Schlüssel, Regeln zum Kopieren, letzte 50 Aufrufe  Teil von #17, #18  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com> 

17 files changed, 503 insertions(+), 17 deletions(-)

### 2. 66f8dac2a - Hinweise auf Neues und schönere Scrollbars (0.7.4)

- Änderungsverlauf: Neuerungen können einen Link tragen („Ansehen“) - Nach einem Update meldet der Planer allen Konten die Neuerungen mit Link in ihrer Sprache (höchstens 5, Anlass „Neue Funktionen“ abschaltbar); Klick in der Glocke führt direkt zur Einstellung - Sprungziele #mcp und #benachrichtigungen im Konto - Scrollbars: schmal, ohne Spur, Designfarben, Akzent beim Anfassen; Firefox über scrollbar-color  Teil von #18  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com> 

13 files changed, 140 insertions(+), 10 deletions(-)

### 3. ee7c06a55 - Wer hat's angelegt? Klare MCP-Fehler (0.7.5)

- Aufgaben merken Ersteller, Namen und Weg (web, mcp, auto) – auf Karte, im Dialog und im Issue („✍️ Erstellt von …“); Nachtrag bestehender Aufgaben aus dem Aktivitätsprotokoll, Folgeaufgaben erben den Ersteller - MCP-401 mit Ursache: missing, malformed, invalid_or_revoked, account_inactive (Body „code“ und WWW-Authenticate) - Prüfspur am Schlüssel: zuletzt benutzt von IP und Programm - Abgelaufene Sitzung: /login?abgelaufen=1 mit Begründung statt stumm - Konto: „Wie lange gilt was“ mit den echten Fristen und Fehlercodes - „KI & MCP“ im Profilmenü - Konsole: Zod ohne eval-Test (CSP), keine nachinstallierten Schriften  Fixes #25 Fixes #26  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com> 

27 files changed, 248 insertions(+), 31 deletions(-)

### 4. 2da938cd5 - Bot-Konto für Issues und Rolle „Bughunter“ (0.7.6)

- Je Git-Verbindung optional ein Bot-Token (verschlüsselt, beim Anbieter geprüft, eigenes Profil als Bot abgelehnt): Issues und Status-Labels laufen dann über den Bot statt unter dem Profil des Besitzers; Commits, CI und Import weiter über den eigenen Zugang - issueTokenCipherFor: Bot der Verbindung zu genau diesem Server, sonst Projekt- oder Konto-Token - Neue Standardrolle „Bughunter“ (Aufgaben, Notizen, Zeit, Git- und Live-Prüfung, Fehler-Eingang) samt Migration - Rollen-Test durchsucht alle Migrationen und prüft auch die Beschreibung  Teil von #22, #24  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com> 

13 files changed, 190 insertions(+), 17 deletions(-)

### 5. 91d85479b - Brett einstellen, Bearbeiter aus dem Team, neue Benachrichtigungs-Seite (0.7.7)

- Aufgabenbrett je Projekt einstellen (Recht „Projektangaben ändern“): Spalten umbenennen, anordnen, ausblenden, Einklappen nach N Karten; Project.boardConfig, PATCH /api/projects/[id]/board, normalizeBoard - Bearbeiter-Vorschläge aus Besitzer, Mitgliedern und Team-Mitgliedern; Meldung „Aufgabe zugewiesen“ an die eingetragene Person (neuer Anlass) - Benachrichtigungs-Einstellungen neu: Kanäle als Kacheln mit Status, Anlässe in vier Gruppen mit Schaltern und „Alle an/aus“ - „Neue Aufgabe mit Details“ mit eigenem Symbol, Zahnrad = Brett einstellen  Fixes #27 Teil von #21  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com> 

19 files changed, 568 insertions(+), 65 deletions(-)

### 6. d117e9dfb - Befunde verständlich, Fork-Meldung, Beiträge als Aufgabe (0.7.8)

- Repo-Check erklärt jeden Befund (Geheimnis, Lücke, Semgrep) in einfacher Sprache mit Lösungsweg und liefert einen Prompt für Claude Code zum Kopieren - Fork-Meldung: Webhook-Ereignis „fork“ (GitHub/Gitea) → Nachricht an den Besitzer mit Link, nichts wird kopiert; neuer Anlass „Fork“ - Community-Beitrag als Aufgabe übernehmen – nur mit Recht „Aufgaben anlegen“ im Projekt; mit Issue-Spiegelung entsteht das GitHub-Issue - MCP-Regeln: KI fragt vor dem Speichern nach Werkzeug und Ort  Fixes #20 Teil von #23, #29, #30  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com> 

16 files changed, 252 insertions(+), 14 deletions(-)

### 7. a61540d0f - Team-Seite: Übersicht, Claude, Wünsche, Chat (0.7.9)

- /teams/[teamId] für Mitglieder (Fremde 404): Mitglieder mit Rollen, Team-Projekte mit offenen Aufgaben und Fehlern, letzte Aktivität - „Woran arbeitet Claude gerade?“: Aufgaben mit Bearbeiter Claude (eingetragen oder laut Issue), Laufendes zuerst - Team-Chat nur für Mitglieder (TeamMessage) - Wünsche ans Team (TeamWish): 3 je Mitglied in 24 h; Verwalter nehmen an (Aufgabe in einem Team-Projekt, reserviert gegen Doppel-Klicks) oder lehnen mit Grund ab; Meldungen an Verwalter und Einreichende - Team-Name in der Teams-Liste führt zur Team-Seite  Teil von #38  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com> 

17 files changed, 887 insertions(+), 3 deletions(-)

### 8. 401e7984a - Kritisches kommt immer durch (0.8.0)

- Neue Stufe „urgent“ → ntfy-Priorität 5 (durchbricht „Nicht stören“, wenn in der ntfy-App erlaubt): neuer/wiederkehrender App-Fehler, Live-Seite nicht erreichbar, Repo-Check mit Geheimnis - NotificationSettings.urgentCritical (Standard an), Schalter in der ntfy-Kachel; aus = Rückstufung auf „hoch“ (withUrgency, getestet)  Teil von #35  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com> 

14 files changed, 49 insertions(+), 9 deletions(-)

### 9. 1a698fcf9 - Passwort vergessen per E-Mail-Link (0.8.1)

Auf der Anmeldeseite gibt es jetzt „Passwort vergessen?“: VibeWorks schickt einen Link an die im Konto hinterlegte E-Mail-Adresse. Der Link gilt eine Stunde, ist nur einmal nutzbar, und nach dem Setzen sind alle anderen Geräte abgemeldet. Gespeichert wird nur der SHA-256 des Tokens.  Ein Admin muss die Funktion erst einschalten (Administration → Einstellungen); ohne eingerichteten E-Mail-Versand bleibt sie aus. Die Anfrage antwortet immer gleich und verrät damit nicht, welche Konten oder Adressen es gibt; dazu Begrenzungen pro IP und höchstens drei Links je Konto und Stunde. Sicherheitsfragen gibt es bewusst nicht, weil sie ratbar sind.  Geprüft mit tsc, 308 Tests, Build, Migration (leerer Diff) und einem Playwright-Durchlauf: Schalter aus, Link nur einmal, zu schwaches Passwort abgelehnt, Anmeldung mit dem neuen Passwort. Dazu ein MCP-Selbsttest (29 Werkzeuge, 6 Ressourcen, alle geprüften Aufrufe antworten).  Fixes #40 Teil von #41  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com> 

20 files changed, 465 insertions(+), 6 deletions(-)

### 10. 6693111df - Admin vergibt ein neues Passwort (0.8.2)

Auf „Passwort vergessen?“ gibt es jetzt den kurzen Weg: einen Admin um ein neues Passwort bitten. Das funktioniert auch ohne hinterlegte E-Mail-Adresse und ohne eingerichteten E-Mail-Versand – deshalb steht der Link auf der Anmeldeseite jetzt immer.  Die Bitte geht als Benachrichtigung an alle Administratoren und erscheint in der Benutzerliste; sobald ein Admin ein Passwort setzt, verschwindet der Hinweis wieder. Höchstens eine Bitte pro Stunde und Konto, dazu eine Grenze pro IP. Auch hier verrät die Antwort nicht, ob es das Konto gibt.  Geprüft mit tsc, 308 Tests, Build, Migration (leerer Diff) und zwei Playwright-Durchläufen: Bitte absenden, Vermerk am Konto, Benachrichtigung beim Admin, Anzeige in der Liste, Erledigung nach dem Setzen – und der komplette Ablauf aus 0.8.1 weiterhin grün.  Fixes #43  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com> 

17 files changed, 172 insertions(+), 45 deletions(-)

### 11. a6ef4e1a2 - Notfix und Code-Suche über MCP (0.8.3)

„Notfix“ im Fehler-Eingang: ein Klick macht aus einem Fehler eine dringende Aufgabe für Claude – heute fällig, mit dem Kennzeichen „notfix“. Stack, Seite und Client bleiben wie bisher im Eingang und wandern nicht ins Issue.  Zwei neue MCP-Werkzeuge für den Code des verknüpften Repositories: list_code_files listet Dateien (mit Überblick und *-Muster), search_code sucht wortwörtlich und liefert Datei, Zeile und die Fundstelle. Gesucht wird im Klon, den VibeWorks ohnehin schon geholt hat – ohne neuen Netzzugriff. Ohne geholte Kopie kommt ein klarer Hinweis statt eines Fehlers.  Geprüft mit tsc, 312 Tests (4 neue für die Index-Logik), Build, leerem Schema-Diff und zwei Playwright-Durchläufen: Notfix über die Oberfläche bis zur fertigen Aufgabe, dazu die Werkzeuge an einem echten Klon dieses Repositories – 578 Dateien erkannt, Muster-Filter, Treffer mit Zeilennummer.  Teil von #39  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com> 

9 files changed, 216 insertions(+), 5 deletions(-)

### 12. c01d2a7f0 - Repo-Check als Aufgaben, Teilen-Link für Mitglieder, CLAUDE.md (0.8.4)

Repo-Check (#47): Jeder Befund lässt sich mit einem Klick als Aufgabe für Claude anlegen – Titel und Prüfauftrag kommen aus dem gespeicherten Bericht, nicht vom Browser, und ein offener gleicher Auftrag wird nicht doppelt angelegt. Dazu eine Besitzer-Einstellung für automatische Aufgaben (aus, nur Dringendes, alles): je Art eine Sammel-Aufgabe, die sich selbst pflegt und sich erledigt, sobald nichts mehr gemeldet wird. Geheimnisse stehen nur mit Datei, Zeile und Regel darin.  Die Semgrep-Meldung zu desktop.yml:28 war berechtigt: Actions hingen an verschiebbaren Tags (@v4). Alle Workflows sind jetzt auf Commit-SHAs gepinnt, auch die Repo-Check-Vorlage – bestehende Checks übernehmen sie beim nächsten Lauf.  Teilen (#46): Wer Mitglieder einladen darf, sieht einen bereits eingeschalteten öffentlichen Link und kann ihn kopieren; schalten kann ihn weiterhin nur der Besitzer.  CLAUDE.md (#44): kompletter Arbeitsablauf – Prüfungen, Version, Changelog, Labels, Abschließen von Issues, Sicherheitsregeln.  Geprüft mit tsc, 318 Tests (6 neue), Build, leerem Schema-Diff und einem Playwright-Durchlauf (Einzel-Aufgabe, keine Dopplung, Stufen „dringend“ und „alles“, Selbst-Erledigung, Teilen-Link).  Fixes #46 Fixes #47 Teil von #44  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com> 

20 files changed, 483 insertions(+), 39 deletions(-)

### 13. 9bf65a290 - Prioritäten für Aufgaben (0.8.5)

Aufgaben haben jetzt eine Priorität wie Projekte: 1 niedrig, 2 normal, 3 hoch, 4 dringend. Auswahl im Aufgaben-Dialog, Zeichen auf der Karte (nur wenn nicht normal) und eine Zeile im gespiegelten Issue. Wiederkehrende Aufgaben übernehmen die Priorität.  Für die KI: list_tasks sortiert nach Priorität, dann Fälligkeit; create_task und update_task nehmen die Priorität an, und die Agenten-Regeln sagen, dass Dringendes zuerst kommt und search_code statt Raten benutzt wird. Notfix-Aufgaben sind dringend, Repo-Check-Aufgaben dringend (Geheimnisse, Lücken) bzw. hoch (Befunde).  Geprüft mit tsc, 319 Tests, Build, leerem Schema-Diff und einem Playwright-Durchlauf (Dialog, Karte, ungültiger Wert, Reihenfolge und Setzen über MCP).  Teil von #48, Teil von #49  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com> 

17 files changed, 74 insertions(+), 12 deletions(-)

### 14. 1f5fca4b4 - Abhängigkeiten aktualisiert (0.8.6)

React und React DOM 19.3 samt Typen, @types/nodemailer 8.0.2, dazu die großen Sprünge lucide-react 1.x und vitest 5 – beide ohne Codeänderung, Typprüfung, alle 319 Tests, Build und drei Playwright-Durchläufe (Board, Dialog, Repo-Check, Fehler-Eingang) sind grün, die Symbole erscheinen wie vorher.  TypeScript 7 bleibt bewusst bei 5.9: die neue, in Go geschriebene Fassung bietet die JavaScript-Schnittstelle nicht mehr, auf die der Build von Next.js setzt.  Teil von #50  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com> 

3 files changed, 133 insertions(+), 165 deletions(-)

### 15. ac51331ec - Info-Fenster und laufende Uhr: sehen, was Claude macht (0.8.7)

Jede Aufgabe hat ein schwebendes Info-Fenster (ⓘ auf der Karte oder „Info“ im Dialog). Es zeigt den aktuellen Stand, jeden MCP-Schritt der KI zu dieser Aufgabe, Commits, die das Issue nennen (#12 trifft nicht #123), den Verlauf und erfasste Zeiten. Es bleibt offen, während man im Board weiterarbeitet, lädt alle 30 Sekunden nach und schließt mit Esc.  MCP-Aufrufe merken sich dafür die Aufgabe – aus den Argumenten oder bei create_task aus dem Ergebnis; Inhalte werden weiterhin nicht gespeichert. Solange eine Aufgabe in Arbeit ist, läuft auf der Karte eine Uhr mit.  Geprüft mit tsc, 322 Tests (3 neue), Build, leerem Schema-Diff und einem Playwright-Durchlauf (Zuordnung der KI-Schritte, Uhr, Inhalt des Fensters, Esc, Öffnen aus dem Dialog, kein Zugriff ohne Anmeldung).  Teil von #48, Teil von #49  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com> 

14 files changed, 448 insertions(+), 8 deletions(-)

### 16. c4503130e - Zod-Einstellung vor allem anderen Code (0.8.8)

Zod 4 entscheidet schon beim Anlegen eines Schemas, ob es per new Function() prüft, ob eval erlaubt ist. Wurde im Browser ein Schema erzeugt, bevor zodSetup lief, meldete die Konsole wieder einen CSP-Verstoß. Die Einstellung „jitless“ steht jetzt zusätzlich in src/instrumentation-client.ts – Next.js lädt sie im Haupt-Chunk vor jeder Seite (im Build geprüft).  Alle Hauptseiten und das Konto (inkl. MCP-Bereich) ohne Konsolenfehler und ohne CSP-Verstöße in Edge geprüft; tsc und Tests grün.  Teil von #55  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com> 

3 files changed, 22 insertions(+), 1 deletion(-)

### 17. b1f377d16 - Code-Netz auf der Projektseite und für die KI (0.8.9)

Das „Synapsen“-Netz aus #39/#57: VibeWorks liest aus dem Klon, den der Repo-Abgleich ohnehin holt, alle Import-Zeilen (JS/TS und Python), löst relative Pfade, den @/-Alias, index-Dateien und .js→.ts auf und baut daraus Knoten (Dateien, Pakete) und Kanten. Keine Inhalte, nur Pfade – und nur für Projektmitglieder. Das Ergebnis bleibt je Commit im Speicher.  Auf der Projektseite zeigt ein neues Panel das Netz mit eigenem Kräfte-Layout (ohne Bibliothek): Bereiche farbig, ziehen, zoomen, suchen, Bereiche oder Pakete ausblenden; ein Klick listet, was eine Datei nutzt und wer sie nutzt, mit Link ins Repository. Abhängigkeiten und Repo-Check bleiben unverändert daneben.  Für die KI: get_code_graph liefert die Zentren, Bereiche und Pakete oder die Nachbarn einer Datei; die Agenten-Regeln sagen, es vor Änderungen an gemeinsam genutzten Dateien zu prüfen.  Geprüft mit tsc, 325 Tests (3 neue), Build und einem Playwright-Durchlauf an einem echten Klon dieses Repositories: 504 Dateien, 2437 Verbindungen, Suche, Auswahl, MCP-Überblick und -Nachbarn, kein Zugriff ohne Anmeldung.  Fixes #57  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com> 

13 files changed, 762 insertions(+), 2 deletions(-)

### 18. d2110faaf - Team sieht die KI arbeiten (0.9.0)

Die Team-Seite zeigt unter „Woran arbeitet Claude gerade?“ eine laufende Uhr an Aufgaben in Arbeit und die letzten 15 KI-Schritte (MCP) in den Team-Projekten der letzten 7 Tage – Werkzeug, Aufgabe, Projekt, Zeit. Inhalte werden nicht gezeigt, Schritte aus anderen Projekten bleiben draußen.  Geprüft mit tsc, 325 Tests, Build und einem Playwright-Durchlauf (Team mit Projekt, KI-Schritte über MCP, Anzeige auf der Team-Seite, fremdes Projekt bleibt unsichtbar).  Teil von #56  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com> 

5 files changed, 72 insertions(+), 4 deletions(-)

### 19. ca251f8af - Hinweis an Claude und Aufgaben-Fenster aus dem Repo-Check (0.9.1)

Info-Fenster (#59): Neues Feld „Hinweis an Claude“ je Aufgabe – eigener Prompt und Arbeitsweise, mit Bausteinen (Tests zuerst, kleine Commits, vor dem Push auf OK warten, nachfragen statt raten). Gespeichert in Task.aiNote, über MCP bei get_task/list_tasks als „instructions“, die Agenten-Regeln sagen, sie zu befolgen. Bleibt privat und landet nie im gespiegelten Issue.  Repo-Check (#60): „Als Aufgabe für Claude“ holt jetzt einen Entwurf vom Server und öffnet damit das Aufgaben-Fenster; angelegt wird erst beim Speichern, Titel, Text, Priorität und Bearbeiter lassen sich vorher anpassen. Gibt es schon eine offene Aufgabe dazu, erscheint ein Hinweis. Der Aufgaben-Dialog kann dafür vorausgefüllt geöffnet werden.  Geprüft mit tsc, 325 Tests, Build, leerem Schema-Diff und zwei Playwright-Durchläufen (Hinweis speichern, neu laden, per MCP lesen; Repo-Check mit Fenster, Anpassung, Doppel-Hinweis, automatische Aufgaben).  Teil von #59, Teil von #60  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com> 

16 files changed, 198 insertions(+), 28 deletions(-)

### 20. 83e4de235 - Memo-Netz, Zweige und Code-Kopie für API-Anbieter (0.9.2)

Korrektur: GitHub-, GitLab- und Gitea-Projekte gleicht VibeWorks über die API ab – einen lokalen Klon gab es nur bei allgemeinen Git-Servern. Code- Suche und Code-Netz blieben dort leer. Jetzt holt ensureCodeCopy() bei Bedarf den neuesten Commit flach (depth 1) in den vorhandenen Zwischen- speicher – mit demselben Token und Host wie der Abgleich, SSRF-geprüft, und nur, wenn es einen neuen Commit gibt (höchstens ein Versuch pro Minute).  Zweige (#60): git ls-remote liefert die Zweige (5 Minuten gemerkt), das Code-Netz bietet ab zwei Zweigen eine Auswahl, list_code_files, search_code und get_code_graph nehmen einen Zweig an. Oben steht der Commit des Netzes.  Memo-Netz (#60): neues Modell CodeMemo – Notiz an einer Datei. Im Netz als gelber Punkt an der Datei, in der Auswahl mit Liste und Formular; über MCP add_code_memo, delete_code_memo und in get_code_graph. Lesen ab Betrachter, schreiben mit Notiz-Recht, Pfade ohne „..“, höchstens 500 je Projekt.  Geprüft mit tsc, 327 Tests (2 neue), Build, leerem Schema-Diff und einem Playwright-Durchlauf gegen GitHub: Kopie für ein Projekt ohne Klon in knapp 4 s geholt, Commit angezeigt, Memo per Oberfläche und MCP, ungültiger Pfad abgelehnt, Zweigwechsel an octocat/Hello-World mit anderem Commit.  Fixes #60  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com> 

18 files changed, 572 insertions(+), 58 deletions(-)

### 21. bab1a67dc - Klare Rückmeldungen, Datei-Filter ohne Regex (0.9.3)

#61 (Repo-Check-Befund detect-non-literal-regexp in codeIndexLogic.ts): Der Befund war berechtigt. filterFiles baute aus dem *-Muster einen regulären Ausdruck; die Zeichen waren zwar entschärft, aber viele „.*“ können sich auf langen Pfaden festrechnen (ReDoS). matchesWildcard prüft dasselbe jetzt ohne Regex in linearer Zeit – Test mit 99 Platzhaltern.  #63: Neuer Toaster im App-Layout – „Aufgabe erfolgreich erstellt“ erscheint unten rechts, wenn eine Aufgabe aus dem Repo-Check (Aufgaben-Fenster) oder dem Fehler-Eingang (Als Aufgabe, Notfix) entsteht; ein vorhandener Auftrag meldet sich ebenso. Der Knopf heißt „Als Aufgabe erstellen“. Die CSP verzichtet in script-src auf 'self' – neben 'strict-dynamic' ignorieren es alle aktuellen Browser, Firefox meldete es nur als Hinweis.  Geprüft mit tsc, 328 Tests, Build und Playwright (alle Hauptseiten ohne CSP-Verstoß, Repo-Check mit Rückmeldung, Notfix, Info-Fenster).  Fixes #61 Fixes #63  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com> 

11 files changed, 146 insertions(+), 12 deletions(-)

### 22. c468c4ce5 - Feedback-Eingang und offizielle Projekte (0.9.4)

Community (#59): Besitzer vorgestellter Projekte sehen „Feedback zu deinen Projekten“ – die neuesten Beiträge (Ideen, Fragen, Fehler) zu allen eigenen Community-Projekten, filterbar nach offen/alle und Art, mit Link direkt zum Beitrag (neuer Anker post-<id>).  Admins markieren Projekte als offiziell (PUT /api/admin/community/official, per SQL ohne „zuletzt geändert“ zu verschieben); offizielle Projekte stehen oben und tragen ein Abzeichen. Neue Spalte Project.communityOfficial.  Geprüft mit tsc, 328 Tests, Build, leerem Schema-Diff und Playwright mit zwei Konten (Idee von bert im Eingang von anna, Filter, Markieren nur als Admin, Reihenfolge und Abzeichen, kein Eingang ohne eigene Projekte).  Fixes #59  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com> 

12 files changed, 233 insertions(+), 7 deletions(-)

### 23. 01b28d223 - Einstellungen je MCP-Schlüssel (0.9.5)

Jeder API-Schlüssel hat eigene Einstellungen (#48/#49): - Umfang: „nur lesen“ (Werkzeuge mit readOnlyHint), „lesen und Aufgaben“ (dazu Aufgaben, Tagesplan, Zeiten, Fehler erledigen, Memos) oder „alles“. Der MCP-Endpunkt bietet nur die erlaubten Werkzeuge an; die Regeln- Werkzeuge gehen immer. Standard bleibt „alles“ – bestehende Schlüssel verhalten sich wie bisher, die Einstellung kann nur einschränken. - Erinnerungen: Standardtext (Status aktuell halten, Hinweise der Aufgabe befolgen, Gelerntes als Memo), eigener Text oder aus – bei jedem n-ten Aufruf des Schlüssels (1–100), mitgeliefert in der Werkzeug-Antwort.  Im Konto klappt je Schlüssel „Einstellungen“ auf; PATCH /api/account/api-tokens/[id] speichert nur für den eigenen Schlüssel. Neuer Index McpCall(tokenId, createdAt) für das Zählen.  Geprüft mit tsc, 334 Tests (6 neue), Build, leerem Schema-Diff und Playwright (Einstellungen in der Oberfläche, nur lesende Werkzeuge, abgelehntes Schreiben, eigene Erinnerung bei jedem Aufruf, Aufgaben-Umfang, Erinnerung aus, ungültige Werte, fremder Schlüssel) sowie dem MCP-Selbsttest.  Teil von #48, Teil von #49  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com> 

12 files changed, 294 insertions(+), 5 deletions(-)

### 24. 7744be814 - Wünsche pro Tag einstellbar, klarere Beschriftungen (0.9.6)

#48/#49: Die Grenze „Wünsche ans Team pro Tag“ (bisher fest 3) stellt der Admin jetzt ein – 1 bis 20 (Settings.wishLimit). Wunsch-Endpunkt, Team-Seite und Hinweistext nutzen den eingestellten Wert.  Aus der Analyse der Einstellungen: ntfy, Webhook und E-Mail sagen jetzt, ob VibeWorks dorthin sendet (Benachrichtigungen) oder von dort empfängt (Ideen-Eingang) – vorher hießen beide Stellen gleich.  Geprüft mit tsc, 334 Tests, Build, leerem Schema-Diff und Playwright (Grenze im Admin setzen, Grenze greift beim dritten Wunsch, Hinweistext, ungültiger Wert abgelehnt; Team-KI-Test weiterhin grün).  Teil von #48, Teil von #49  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com> 

16 files changed, 72 insertions(+), 19 deletions(-)

### 25. 82bad12bd - Eingeschränkt statt kaputt: abgeschaltete Issues pausieren (0.9.7)

#66: Hat ein Repository die Issues abgeschaltet (HTTP 410), versuchte VibeWorks es bei jedem Abgleich neu – für bis zu 25 Aufgaben plus die Issue-Liste, alle 5 Minuten. Das verbrauchte GitHub-Aufrufe (dasselbe Token dient oft mehreren Projekten) und markierte jede Aufgabe als Fehler.  Jetzt merkt sich das Projekt den Zeitpunkt (Project.issuesOffAt) und fragt 24 Stunden lang nicht nach; die Fehlermarken an den Aufgaben werden entfernt. Ein erfolgreicher Abruf, das Einschalten der Spiegelung oder „Jetzt erneut prüfen“ hebt die Pause auf. Das Git-Panel zeigt statt eines Fehlers einen ruhigen Hinweis: nur eine Einschränkung, alles andere läuft.  Für die KI: get_repo_status liefert „areas“ (commits, issues, ci, deps mit ok/limited/off/error) und bei Bedarf „limitations“ samt Hinweis, dass das Repository nicht kaputt ist; die Agenten-Regeln sagen dasselbe.  Geprüft mit tsc, 340 Tests (6 neue), Build, leerem Schema-Diff und Playwright (Hinweis statt Fehler, MCP-Bereiche und Erklärung, erneut prüfen hebt die Pause auf). Einen echten HTTP 410 kann der lokale Test nicht auslösen – der Weg ist über den Code und die Einheitentests abgedeckt.  Fixes #66  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com> 

14 files changed, 213 insertions(+), 15 deletions(-)

### 26. 002dd26aa - Code-Netz: Vollbild, Mausrad-Zoom, verständliche Fehler (0.9.8)

#67: - Das Mausrad zoomt: React registriert Wheel-Events passiv, der Browser scrollte deshalb die Seite. Jetzt ein eigener Listener mit passive: false und preventDefault. - Vollbild: neuer Knopf, Esc beendet, danach wird eingepasst. Die Ansicht hängt per Portal an body – im Glas-Panel (backdrop-filter) blieb „fixed“ sonst im Panel gefangen. - Klappt das Holen der Code-Kopie nicht, wird die Ursache übersetzt angezeigt (z. B. „Der Git-Server lehnt den Zugang ab“) und „Kopie jetzt holen“ erzwingt einen neuen Versuch (?refresh=1, umgeht die Minute Wartezeit).  Zur Frage, ob abgeschaltete Issues das Netz verhindern: nein – der GitHub-Abgleich ruft keine Issue-Schnittstelle auf, und seit 0.9.7 pausieren Issues nur noch. Bleibt das Netz leer, nennt die Meldung jetzt den wahren Grund (meist fehlender Lesezugriff des Tokens).  Geprüft mit tsc, 340 Tests, Build und Playwright (Seite scrollt nicht, Netz zoomt, Vollbild 1400×900, Esc, verständliche Meldung, Knopf).  Fixes #67  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com> 

7 files changed, 104 insertions(+), 29 deletions(-)

### 27. 664132956 - Fehler-Agent: neue Fehler sofort als Notfix-Aufgabe (0.9.9)

#39 (Automatisierung „wenn Bugs gefunden wurden, Aufgaben erstellen“): Neue Projekt-Einstellung im Fehler-Eingang (nur Besitzer, Standard aus). Ist sie an, wird jeder neue Fehler – und jeder erledigte, der wiederkommt – nach der Antwort an die App zur Notfix-Aufgabe: Bearbeiter Claude, Priorität dringend, heute fällig, Weg „auto“. Ohne KI, ohne Kosten.  Schutz, weil der Eingang öffentlich ist (nur der Projekt-Schlüssel): höchstens 5 automatische Aufgaben je Projekt und Stunde, keine zweite Aufgabe solange eine offene zum Fehler existiert, und wie beim Knopf keine Stack-, Seiten- oder Client-Angaben im (womöglich gespiegelten) Text.  Die Aufgaben-Erstellung aus einem Fehler liegt jetzt in lib/errorTasks und wird vom Knopf und vom Agenten gemeinsam genutzt.  vitest zurück auf 4.1: Mit 5.0 scheiterten unter Windows gelegentlich alle Test-Dateien beim Start („reading 'config'“) – reproduzierbar, mit 4.1 in fünf Läufen in Folge grün.  Geprüft mit tsc, 340 Tests, Build, leerem Schema-Diff und Playwright (aus: nichts; an: Notfix mit richtigen Feldern ohne Stack; gleicher Fehler ohne Dopplung; Flut auf 5 begrenzt; Notfix-Knopf weiterhin grün).  Teil von #39  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com> 

12 files changed, 269 insertions(+), 121 deletions(-)

### 28. 69ced2913 - Beta-Ansicht für Admins (1.0.0)

#68: Admins starten unter Administration → Einstellungen die Beta-Ansicht. Sie setzt ein httpOnly-Cookie (8 Stunden); solange es da ist, - zeigt jede Seite oben einen roten Balken mit rotem ✕ zum Beenden, - lehnt route() alle schreibenden Anfragen ab (403 „Beta-Ansicht …“) – ausgenommen Beenden, An-/Abmelden und Sprache. Lesen geht normal. Nur Admins dürfen sie starten; beenden darf jeder mit dem Cookie. Wer es sich selbst setzt, sperrt nur die eigenen Änderungen – andere Konten merken nichts. Künftige Beta-Oberflächen hängen an BETA_FEATURES.  Mit 0.9.9 → 1.0.0 springt die Version nach dem üblichen Schema.  Korrektur zu 0.9.9: Die sporadischen Startabbrüche der Tests („reading 'config'“, alle Dateien auf einmal) treten auch mit vitest 4 auf – die Version war nicht die Ursache; der Changelog-Satz dazu ist entfernt. Der Test-Code ist nicht betroffen, ein zweiter Lauf ist jeweils grün.  Geprüft mit tsc, 342 Tests (2 neue), Build und Playwright (Nicht-Admin abgelehnt, Balken auf allen Seiten, Schreiben 403, Lesen ok, andere Konten unberührt, ✕ beendet, danach wieder schreibbar).  Fixes #68  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com> 

11 files changed, 177 insertions(+), 3 deletions(-)

### 29. 1ec9e4175 - Eigene Spaltennamen überall, Hinweis an die KI, Sicherheits-Funde (1.0.1)

- Umbenannte Spalten erscheinen in Aufgabenliste, Dialog, Info-Fenster und Team-Seite - „Hinweis an die KI“ statt „Hinweis an Claude“, sichtbar auf Karte und im Dialog - Fehlgeschlagene Code-Kopie meldet sich (höchstens einmal am Tag je Projekt) - Repo-Check-Funde: GCM-Tag-Länge, hasOwn bei Übersetzungen, feste Log-Formate, Issue-Erwähnungen ohne Regex aus Eingaben  Fixes #71 Fixes #72 Fixes #73  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com> 

24 files changed, 143 insertions(+), 28 deletions(-)

### 30. 811f759f4 - Bot per Klick als GitHub App, Agenten schreiben Deutsch (1.0.2)

- „Bot per Klick erstellen“: GitHub-App über den Manifest-Ablauf, nur Issues schreiben und Metadaten lesen, keine Webhooks; Installations-Token je Repository, ohne Installation weiter über den eigenen Zugang - Einmaliger state je Nutzer, Rücksprung nur angemeldet; CSP form-action erlaubt dafür https://github.com - Agenten-Regeln: Einträge in der Kontosprache, keine Antwort ohne Blick auf offene Aufgaben über MCP; CLAUDE.md ergänzt  Fixes #74  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com> 

21 files changed, 927 insertions(+), 274 deletions(-)

### 31. 4b04cde86 - Fehler-Eingang: Stapel, Log-Zeilen, Electron-Schnipsel (1.0.3)

- Bis zu 50 Berichte je Anfrage; Projektlimit zählt je Bericht - Mehr Formate: verschachtelte Fehler, deutsche Feldnamen, Details (Absturzgrund, Exit-Code), Log-Zeilen „<Zeit> [CRASH] Text“ - Hilfreiche 400-Antwort, Grenze 128 KB - Einbau-Schnipsel für Electron (render-/child-process-gone, gesammelt)  Fixes #75  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com> 

7 files changed, 199 insertions(+), 29 deletions(-)

### 32. 3eb428849 - Code-Netz meldet Gründe, MCP englisch, Regel-Erinnerung (1.0.4)

- Code-Netz: Panel auch nach gescheitertem Abgleich, klare Gründe (nicht abgeglichen, Abgleich scheitert, keine Dateien, alter Stand), Rückmeldung nach erfolgreichem Laden - Automatische Aufgaben ohne voreingetragenen Bearbeiter - MCP: Fehlermeldungen immer englisch - Regeln mit Fingerabdruck: bei Änderungen erneute Erinnerung, „Regeln veraltet“ unter API-Schlüssel  Fixes #81 (Bearbeiter) Teil von #79  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com> 

21 files changed, 139 insertions(+), 36 deletions(-)

### 33. 8615b9827 - Bot-Befehle, Unterhaltung im Info-Fenster, KI-ID (1.0.5)

- Issue-Kommentare: /status, /prio, /übernehmen, /freigeben, /fällig, /ki, /info, /hilfe – nur mit Schreibrecht, Bot antwortet im Issue - Info-Fenster: Unterhaltung des Issues lesen und antworten - MCP-Aufrufe merken gesehene Aufgaben; KI-ID je Schlüssel - Erklärung des Bots unter Git-Zugänge  Teil von #76 Teil von #79 Teil von #81  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com> 

22 files changed, 841 insertions(+), 16 deletions(-)

### 34. 95c55e195 - KI-Sperre für Aufgaben und Spalten, Issues nur unter eigenem Namen (1.0.6)

- Task.aiLocked und boardConfig.aiLocked: über MCP unsichtbar (Listen, Projekt, Suche, Heute, Probleme, CLAUDE.md), direkte Zugriffe „not found“, keine Anlage in gesperrten Spalten, Issue ohne Inhalt - Issues fremder Aufgaben über den eigenen Git-Zugang oder den Bot, nie unter dem Konto des Besitzers; sonst Hinweis an der Aufgabe  Teil von #76  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com> 

21 files changed, 207 insertions(+), 33 deletions(-)

### 35. 9461c952c - Eigene Zusatz-Spalten im Aufgabenbrett (1.0.7)

- boardConfig.extra (bis 6) mit Grundspalte, Task.column - Brett: Spalte je Aufgabe aus Status + Spalte, Sortieren mit Spalte, ab 5 Spalten seitlich scrollbar - Einstellungen: Spalten anlegen, benennen, entfernen, für KI sperren - Dialog und Liste zeigen Zusatz-Spalten; Statuswechsel führt zurück in die Grundspalte; entfernte Spalten räumen Aufgaben auf  Fixes #76  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com> 

20 files changed, 363 insertions(+), 86 deletions(-)

### 36. d88ce45c2 - MCP-Einzeiler, strengere Agenten-Regeln, Sperre gegen Wiederholungs-Ketten (1.0.8)

- /api/mcp/install/sh und /ps1: öffentliche Skripte ohne Daten, Schlüssel aus VIBEWORKS_KEY; tragen VibeWorks in Claude Code ein und speichern die Regeln (auch Gemini CLI); PowerShell-Skript rein ASCII - /api/mcp/rules: Regeln per Schlüssel, zählt als bestätigt - Einzeiler nach dem Erstellen eines Schlüssels - Regeln: Pflicht-Abschnitt (Aufgaben zu Beginn und Ende, keine Arbeit ohne Aufgabe, Status stimmt, Wiederholungen nicht sofort erledigen) - update_task lehnt DONE für gerade entstandene Wiederholungen ab  Fixes #89  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com> 

11 files changed, 235 insertions(+), 6 deletions(-)
