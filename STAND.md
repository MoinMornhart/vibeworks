# Stand: VibeWorks (Übergabe 2026-10-24)

## Was es ist
Selbst gehostetes Kontrollzentrum für Philips Vibe-Coding-Projekte: Projekte, Aufgaben, Notizen, Docs, Commits und KI-Anbindung (MCP) an einem Ort, läuft auf dem eigenen Proxmox-Server. Spiegelt Aufgaben als GitHub-Issues in die Projekt-Repos, betreibt den „VibeWorks Repo-Check“ in den Repos. Dazu Windows-App (`desktop/`) und Webseite/Doku (`site/`, GitHub Pages).

## Aktueller Stand (Version 1.8.9 auf `main`)
- Projekte, Aufgabenboard, Heute-Ansicht, Review, Docs mit Baum/Markdown/Freigabe, Node-Editor, CI-Designer, Fehler-Eingang, Rechte je Projekt/Team, eigene Anmeldung (MFA/Passkeys), OAuth, MCP-Server für KIs.
- 1.7.7–1.8.4 sind auf `main` und live:
  - Sicherheitslücken geschlossen + 14 Paket-Updates (#216), leichtere Projektseite, SSRF-Fix und die 4 Funde aus dem Selbst-Pentest.
  - Leinwand in den Docs: Zettel, Formen, Texte, Bilder, Freihand, drehen, Vollbild, **Echtzeit auf mehreren Geräten** (1.8.2).
  - Knopf, um Bugs gesammelt als Aufgaben ins Board zu holen (1.8.1).
  - Leinwände teilen (1.8.3, PR #222): nur angemeldete Konten/Teams, Rechte Ansehen/Bearbeiten – Moinis Entscheidung, kein öffentlicher Link.
  - Repo-Check-Karte „Funde automatisch als Aufgaben“ (1.8.4, PR #223).
- **1.8.5 (24.10., PR #225):** Der Knopf aus 1.8.4 war live **nicht sichtbar** – die Projektseite gab `RepoCheckPanel` die Berechtigung `canEditSettings` (`project.edit`) nicht mit, der Standardwert ist `false`. Jetzt durchgereicht (Fix aus `79a1f52`, neu auf `main` aufgesetzt). Lokal im Browser mit Besitzer/Bearbeiter/Betrachter geprüft; **live-Bestätigung durch Moini steht aus**. Der alte Branch `claude/fervent-gauss-csxl3r` ist damit überholt.
- **1.8.6 (25.10.):** Sicherheitslücken geschlossen (undici 7.30.1, nodemailer 10.2.1, fast-uri 3.1.9, electron 44.9.3 – `npm audit`: 0 im Hauptprojekt und in `desktop/`), Wartungs-Updates (#206) und die shellcheck-Funde im Cloud-Hook (#224).
- **1.8.7 (27.10.):** Adresse (Domain) im Admin-Dashboard übernehmen – nur die, über die man gerade drin ist; gespeichert in `Settings.appUrl` samt `.env`-Wert beim Übernehmen. Ändert sich `APP_URL` in der `.env`, gilt beim nächsten Start wieder die `.env` und die übernommene Adresse wird gelöscht (Rettungsweg). Logik: `src/lib/appUrlLogic.ts`.
- **1.8.8 (29.10.):** Neuer GitHub-Benutzername/Repo-Umzug legte jedes Repo per Auto-Import doppelt an. Jetzt: Umbenennung erkennen (`renameCandidates` in `importLogic.ts`), beim Anbieter bestätigen (alte Adresse leitet weiter), Projekt umhängen, unberührte Kopien löschen, `skipRepos` mitnehmen (`followRenames` in `importRepos.ts`).
- CI und Repo-Check am 2026-10-24 grün.

## Zuletzt gemacht
- 2026-10-30: 1.8.9 Paket-Updates (#206/#230, nur Minor/Patch). #230 war eine Kopie von #206 (aus einem doppelten Projekt) – geschlossen.
- 2026-10-29: 1.8.8 doppelte Projekte nach Benutzernamen-Wechsel (Moini).
- 2026-10-27: 1.8.7 Adresse im Admin-Dashboard übernehmen (Moinis Wunsch, Variante „aktuelle Adresse übernehmen“).
- 2026-10-25: 1.8.6 Sicherheitslücken + Paket-Updates + shellcheck (#216, #217, #206, #224).
- 2026-10-24: 1.8.5 Knopf „Funde automatisch als Aufgaben“ sichtbar (PR #225); Übergabe der Cloud-Sitzung „VibeWorks“ (17.–24.10.) in diese Datei.
- 2026-10-24: Cloud-Start-Hook (`.claude/hooks/skills-cloud.sh`).
- 2026-10-19: 1.8.4 Funde als Aufgaben; 1.8.3 Leinwände teilen. Issue-Runde ausgeschaltet.
- 2026-10-18: 1.8.2 Leinwand live auf mehreren Geräten; 1.8.1 Fehler ins Aufgabenboard.
- 2026-10-17: 1.7.7–1.8.0 Sicherheitslücken, leichtere Projektseite, Leinwand-Werkzeuge, SSRF-Schutz.
- 2026-10-05: 1.7.6 schneller bei vielen Aufgaben (/tasks 1592 kB → 421 kB, #214).

## Offen / Nächste Schritte
- **Zuerst:** Moini bestätigt, dass der Knopf live zu sehen ist (Projekt → Repo-Check; erscheint nur bei eingeschaltetem Repo-Check und GitHub-Repository).

Offene GitHub-Issues (Stand 24.10.):
- #224, #217, #216, #206: mit 1.8.6 erledigt. Der Windows-Installer ist noch 0.0.1 vom 11.09. – Electron 44.9.3 erreicht Nutzer erst, wenn die Version in `desktop/package.json` steigt (dann baut `desktop.yml` einen neuen Installer). **Entscheidung von Moini offen.**
- #206: offen bleiben nur die Major-Sprünge **undici 8** (steckt im SSRF-Schutz, eigener geprüfter Schritt) und **electron 45** (Windows-App).
- #227 (JoniMoni): BetterCI (`EZdev0/BetterCI`) testen/einbauen – Repo nicht abrufbar (privat oder gelöscht), nachgefragt.
- #228 = neuer täglicher Durchgang von #212.
- #214 „Vibeworks laggt“ (kritisch, JoniMoni) – 1.7.6 und 1.7.9 drin, Issue noch offen; ob Lag behoben: **unklar**, keine Rückmeldung.
- #212 Issues sauber zwischen GitHub und VibeWorks syncen, Konten/Rechte („Arbeiter“, „Bughunter“) prüfen, kostenlose GitHub-App o. ä. (kritisch, täglich wiederkehrend).
- #211 Plan Leinwand („Notion-artig“) und **Anrufe** – Leinwand weitgehend umgesetzt; offen: Anrufe-Teil, Zuschneiden/Audio, Test des Teilens mit zwei Konten.
- #205 Notion-artiges Dashboard (Ausgangsidee zu #211).
- #124 Scheduler, 5 Erweiterungen, Community/Chats, kostenlose Repo-Prüfung (wöchentlich, fällig 20.10.).
- Auf Moinis Server gibt es den Befehl `update` nicht (`update --domain` → „command not found“, 27.10.). Unklar, wie der Server `main` zieht und ob der Update-Knopf im Admin-Dashboard dort geht – bei Gelegenheit klären.
- Geplante Aufgabe „Issue-Runde VibeWorks“ (zuletzt alle 2 Std.) am 19.10. **ausgeschaltet** (Guthaben sparen).
- Offene Frage an Moini: Gilt die JoniMoni-Ausnahme aus `CLAUDE.md` weiter? (Bei PKmessenger entscheidet Moini Größeres und Sicherheit selbst.)

## Wichtige Infos
- Technik: Next.js 16 (App Router, `src/proxy.ts`), Prisma 7 + PostgreSQL, zod, vitest; Prisma-Client in `src/generated/prisma`.
- Prüfen vor Push: `npx tsc --noEmit`, `npx vitest run`, `npm run check:code` (fallow), `npm run build`, bei Oberflächenänderungen Browser-Durchgang (Playwright); bei Schemaänderung Migration + `npx prisma migrate diff … --script` (muss leer sein).
- Version: `npm run version:bump` (ein Schritt pro Update), Changelog in `src/lib/changelog.ts` (DE + EN).
- Start lokal: `npm run dev`; Standard-Port 3000 (`.env.example`).
- Deploy: Proxmox-LXC, Server holt `main` alle ~15 Minuten selbst – **was auf `main` ist, ist live**. Cloud-Sitzungen erreichen den Server nicht.
- MCP: `src/app/api/mcp/route.ts`, Werkzeuge `src/lib/mcp/tools.ts`. Der VibeWorks-MCP ist in Cloud-Sitzungen nicht verbunden – dort läuft alles über GitHub.
- Repo: seit 29.10. `pmornhart/vibeworks` (GitHub-Name geändert; vorher `MoinMornhart/vibeworks`, davor `Morni-Team/vibeworks` – GitHub leitet weiter), öffentlich, Lizenz MIT. Lokal: `C:\Projekte\VibeWorks`.
- Ausführliche Arbeitsregeln stehen in `CLAUDE.md`; `JULES_MEMORY.md` gilt für Jules.

## Philips Vorgaben
- Regeln aus `CLAUDE.md`: VibeWorks-MCP für Aufgaben nutzen; Deutsch + Englisch; Commits deutsch mit `Co-Authored-By: Claude …`; Sicherheitsänderungen vorher mit Moini (Philip) klären – Ausnahme: Issues von JoniMoni (JONIMONI09).
- Ablauf je Update: alles grün testen (tsc, Tests, fallow, Build, Browser bei UI) → Versionsschritt + Changelog DE/EN → **PR → bei grüner CI Squash-Merge auf `main`**. Updates, die nur auf einem Branch liegen, zählen nicht.
- **Ergebnisse müssen live sichtbar sein:** Fragt Moini nach einem Knopf, muss er wirklich live zu sehen sein – nicht nur gemergt. Erst „fertig“ melden, wenn das geprüft ist (lokal im Browser mit echten Rechten; live bestätigt Moini, weil Cloud-Sitzungen den Server nicht erreichen).
- Neue Funktionen sollen ab Werk eingeschaltet sein und gleich einmal durchlaufen.
- Kurz und locker antworten, auf Deutsch.
- Feste Runden 8:23 und 19:47 Uhr, nachts (23–7 Uhr) keine; still beenden, wenn nichts ansteht. Die automatische Issue-Runde ist derzeit **aus**.
- Kostenpflichtige Dienste nur nach Rückfrage; Guthaben sparen.
- Den Mod **cache-tax will Moini nicht**.
- „Verfasst mit Claude 🤖“ in Git-Texten: im Repo **nicht** festgelegt.
- Update-Funktion: ja (Server zieht `main` selbst).

Diese Datei wird beim Arbeiten aktuell gehalten: nach jedem größeren Schritt „Aktueller Stand“ und „Offen“ anpassen.
