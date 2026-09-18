---
name: vibeworks
description: Arbeitet mit dem VibeWorks-Kontrollzentrum des Nutzers über MCP – Projekte, Aufgaben, Notizen, Docs, Fehler-Eingang und Zeiten. Jede Sitzung in diesem Repository beginnt mit einem Blick auf die offenen Aufgaben.
---

# VibeWorks MCP – Pflicht für jeden Agenten in diesem Repository

Diese Skill-Datei fasst die wichtigste Regel aus `CLAUDE.md` und aus den
Agenten-Regeln des VibeWorks-MCP-Servers (`src/lib/mcp/agentRules.ts`)
zusammen. Die vollständige, aktuelle Fassung holt sich ein Agent per MCP über
`get_agent_rules` (dort steht auch, wo die Datei lokal gespeichert werden soll).

## Die eine Regel

**Nutze den VibeWorks-MCP immer.** Aufgaben, Notizen, Probleme und
Struktur laufen über die MCP-Werkzeuge – nicht über GitHub-Kommentare,
eigenen Kopfnotizen oder Gedächtnis.

1. **Vor jeder Antwort** die offenen Aufgaben prüfen: `list_tasks`,
   und wenn etwas kaputt sein könnte `list_problems`.
2. **Ohne Aufgabe keine Code-Änderung:** Erst `get_task` zum passenden
   Eintrag; fehlt er, vorher `create_task`.
3. **Status immer aktuell:** Beim Anfangen `update_task` auf `DOING`
   mit dem eigenen Namen als `assignee`, wenn blockiert `BLOCKED`
   mit Grund, `DONE` erst nach echter Verifikation.
4. **Am Ende jeder Antwort** erneut die offenen Aufgaben prüfen und
   benennen, was noch wartet. Keine Antwort ohne MCP-Nutzung.
5. **Größere Arbeit** (Feature, Bugfix, Release, Review) läuft als
   Workflow: `list_workflows`, dann `start_workflow`, Schritte einzeln
   mit `complete_workflow_step` und Beleg abhaken.
6. **Wiederkehrende Aufgaben** nach dem Erledigen offen lassen, bis der
   neue Durchgang fällig ist – den nie sofort wieder auf DONE setzen.

Ist der VibeWorks-MCP in der Umgebung nicht verbunden, laut sagen und
den Nutzer bitten, ihn zu verbinden – nicht stillschweigend nur über
GitHub arbeiten.

## Sicherheit

- Keine Tokens, Passwörter oder Zugangsdaten in Aufgaben, Notizen oder Docs.
- Rechte-Fehler („nur Ansicht", „nur Besitzer") respektieren und melden,
  nicht umgehen.
- Vor dem Anlegen prüfen, ob Aufgabe/Notiz/Workflow schon existiert.
