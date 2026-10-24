# Stand: VibeWorks (Übergabe 2026-10-24)

## Was es ist
Selbst gehostetes Kontrollzentrum für Philips Vibe-Coding-Projekte: Projekte, Aufgaben, Notizen, Docs, Commits und KI-Anbindung (MCP) an einem Ort, läuft auf dem eigenen Proxmox-Server. Spiegelt Aufgaben als GitHub-Issues in die Projekt-Repos, betreibt den „VibeWorks Repo-Check“ in den Repos. Dazu Windows-App (`desktop/`) und Webseite/Doku (`site/`, GitHub Pages).

## Aktueller Stand (Version 1.8.4)
- Projekte, Aufgabenboard, Heute-Ansicht, Review, Docs mit Baum/Markdown/Freigabe, Node-Editor, CI-Designer, Fehler-Eingang, Rechte je Projekt/Team, eigene Anmeldung (MFA/Passkeys), OAuth, MCP-Server für KIs.
- Leinwand in den Docs (1.7.2–1.8.3): Zettel, Formen, Texte, Bilder, Freihand, drehen, Vollbild, **live auf mehreren Geräten**, mit anderen teilen.
- Repo-Check-Funde per Knopfdruck als Aufgaben (1.8.4), Fehler gesammelt ins Board (1.8.1).
- Sicherheits-Durchgang SSRF-Schutz (1.8.0). CI und Repo-Check am 2026-10-24 grün.

## Zuletzt gemacht
- 2026-10-24: Cloud-Start-Hook (`.claude/hooks/skills-cloud.sh`).
- 2026-10-19: 1.8.4 Funde als Aufgaben; 1.8.3 Leinwände teilen.
- 2026-10-18: 1.8.2 Leinwand live auf mehreren Geräten; 1.8.1 Fehler ins Aufgabenboard.
- 2026-10-17: 1.7.7–1.8.0 Sicherheitslücken, leichtere Projektseite, Leinwand-Werkzeuge, SSRF-Schutz.
- 2026-10-05: 1.7.6 schneller bei vielen Aufgaben (/tasks 1592 kB → 421 kB, #214).

## Offen / Nächste Schritte
Offene GitHub-Issues (Stand 24.10.):
- #224 Repo-Check: 2 shellcheck-Befunde in `.claude/hooks/skills-cloud.sh` (Zeile 81 SC1087, Zeile 86 SC2115) – kommt vom neuen Cloud-Hook.
- #217 / #216 Sicherheitslücken: electron, undici, nodemailer, fast-uri u. a. (11 Befunde).
- #206 7 Abhängigkeiten aktualisieren (electron-builder, fallow, lucide-react …).
- #214 „Vibeworks laggt“ (kritisch, JoniMoni) – erster Schritt 1.7.6 drin, Issue noch offen; ob Lag behoben: **unklar**.
- #212 Issues sauber zwischen GitHub und VibeWorks syncen, Konten/Rechte („Arbeiter“, „Bughunter“) prüfen, kostenlose GitHub-App o. ä. (kritisch, täglich wiederkehrend).
- #211 Plan Leinwand („Notion-artig“) und **Anrufe** – Leinwand weitgehend umgesetzt, Anrufe-Teil offen; offene Entscheidungen im Issue.
- #205 Notion-artiges Dashboard (Ausgangsidee zu #211).
- #124 Scheduler, 5 Erweiterungen, Community/Chats, kostenlose Repo-Prüfung (wöchentlich, fällig 20.10.).
- Geplante Aufgabe „Issue-Runde VibeWorks“ wurde am 19.10. **ausgeschaltet** (Guthaben sparen).
- Bekannte Fehler: siehe #214, #224.

## Wichtige Infos
- Technik: Next.js 16 (App Router, `src/proxy.ts`), Prisma 7 + PostgreSQL, zod, vitest; Prisma-Client in `src/generated/prisma`.
- Prüfen vor Push: `npx tsc --noEmit`, `npx vitest run`, `npm run build`; bei Schemaänderung Migration + `npx prisma migrate diff … --script` (muss leer sein).
- Version: `npm run version:bump` (ein Schritt pro Update), Changelog in `src/lib/changelog.ts` (DE + EN).
- Start lokal: `npm run dev`; Standard-Port 3000 (`.env.example`).
- Deploy: Proxmox-LXC, Server holt `main` alle 15 Minuten selbst – **was gepusht ist, ist live**.
- MCP: `src/app/api/mcp/route.ts`, Werkzeuge `src/lib/mcp/tools.ts`.
- Repo: `Morni-Team/vibeworks` (öffentlich, README verlinkt noch `MoinMornhart/vibeworks`), Lizenz MIT. Lokal: `C:\Projekte\VibeWorks`.
- Ausführliche Arbeitsregeln stehen in `CLAUDE.md`; `JULES_MEMORY.md` gilt für Jules.

## Philips Vorgaben
- Regeln aus `CLAUDE.md`: VibeWorks-MCP für Aufgaben nutzen; Deutsch + Englisch; Commits deutsch mit `Co-Authored-By: Claude …`; Sicherheitsänderungen vorher mit Moini (Philip) klären – Ausnahme: Issues von JoniMoni (JONIMONI09).
- Feste Runden 8:23 und 19:47 Uhr, nachts (23–7 Uhr) keine; still beenden, wenn nichts ansteht.
- Kostenpflichtige Dienste nur nach Rückfrage.
- „Verfasst mit Claude 🤖“ in Git-Texten: im Repo **nicht** festgelegt.
- Update-Funktion: ja (Server zieht `main` selbst).

Diese Datei wird beim Arbeiten aktuell gehalten: nach jedem größeren Schritt „Aktueller Stand“ und „Offen“ anpassen.
