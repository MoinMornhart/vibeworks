# Skill: Oberfläche ändern (i18n + Changelog + Version)

## Wann laden?
Bei jeder Änderung an sichtbaren Oberflächentexten oder bei einem fertigen Update.

## Pflichten

1. **Jeder sichtbare Text zweisprachig** (`src/lib/i18n/messages/<bereich>.ts`):
   Deutsch maßgeblich, Englisch als `en` mit `Shape<typeof de>` – TypeScript
   zwingt bei fehlenden Schlüsseln, trotzdem beide Texte sinnvoll schreiben,
   nicht nur übersetzen.
2. **Genau ein Versionsschritt pro Update:** `npm run version:bump`
   (0.0.1-Schritte, Übertrag bei 9).
3. **Changelog oben** in `src/lib/changelog.ts` – de und en (`titleEn`, `en`),
   Typ `neu` / `besser` / `fix`, optional `link` auf die Stelle. Ein Test
   gleicht den obersten Eintrag mit `package.json` ab.
4. UI-Änderungen zusätzlich im Browser durchspielen (hier: offen sagen, dass
   nur Typprüfung/Tests/Build lokal liefen).

## Stolperstein

`str_replace` mit mehrzeiligen `oldString` scheitert oft an unsichtbaren
Unterschieden – erst die exakte Stelle lesen, dann ersetzen; bei Fehlschlag
kleinere Anker wählen.
