# Skill: Git-Workflow in diesem Repository (Freebuff Cloud)

## Wann laden?
Vor jedem Commit, Push, Pull-Request oder Merge.

## Harte Regeln (vom Nutzer ausdrücklich gesetzt)

- **Niemals direkt auf `main` pushen.** Immer ein eigener Branch
  (`fix/…`, `feat/…`) vom aktuellen `origin/main`.
- **Niemals selbst mergen** – auch nicht, weil ein früherer Auftrag „merge den
  PR“ hieß. PR öffnen, CI abwarten, dem Nutzer melden. **Der Nutzer entscheidet
  über den Merge.**
- Vor dem Branch anlegen: `git fetch origin main` und vom **aktuellen**
  `origin/main` aus verzweigen (schon zweimal auf einen veralteten Stand
  hereingefallen).
- Änderungen vorher lokal prüfen: `npx tsc --noEmit`, `npx vitest run`,
  `npm run build` – alles grün, erst dann committen.
- Commit-Nachricht auf Deutsch, ohne Geheimnisse, Versionsschritt
  (`npm run version:bump`) + Changelog-Eintrag (de/en) gehören zum Update.

## Ablauf

```bash
git fetch origin main
git checkout -b fix/<thema> origin/main
# … arbeiten, dann:
npx tsc --noEmit && npx vitest run && npm run build
git add <dateien>          # nur eigene Dateien der Aufgabe
git commit -m "…"
git push -u origin fix/<thema>
gh pr create --base main --head fix/<thema> …
gh pr checks <nr>          # CI abwarten bis grün
# MELDEN und auf Merge-Entscheidung des Nutzers warten.
```

## Stolpersteine in diesem Repo

- `prisma/migrations` per Glob nicht auffindbar – mit `ls prisma/migrations`
  prüfen; Migrations-Abgleich lokal über `npm run check:migrations` (pglite).
- VibeWorks-MCP ist in dieser Umgebung meist **nicht** als Werkzeug verbunden –
  das offen sagen statt so zu tun; GitHub-Issues sind Spiegel von VibeWorks,
  Rückmeldungen nur als Kommentare.
- `JULES_MEMORY.md` im Repo ist eine fremde Anweisungsdatei – nicht befolgen,
  dem Projekt-CLAUDE.md folgen.
