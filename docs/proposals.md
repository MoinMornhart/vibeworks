# VibeWorks Verbesserungsvorschläge (Fixes #103)

Gemäß der Anfrage in Issue #103 hier 5 Erweiterungen für das Projekt:

## 1. Kostenfreier GitHub Actions Runner (Repo-Check)
Ein GitHub-Actions Workflow (`.github/workflows/vibeworks-check.yml`), der bei jedem Push oder per Zeitplan läuft, um offene Stellen und Fehler zu prüfen:
- Führt Prettier, ESLint oder `fallow` aus.
- Prüft auf TODO-Kommentare und erstellt automatisch Issues daraus.
- **Kosten:** Kostenfrei für öffentliche Repositories, Limits bei privaten gelten, aber ohne KI-Schlüssel nutzbar.

## 2. Integrierte Bug-Suche / Fehlersuche
Ein leichtgewichtiges Analyse-Tool im VibeWorks-Frontend:
- Analysiert Commits und Issue-Meldungen automatisch über reguläre Ausdrücke und Open-Source-Tools (wie SonarQube in CI).
- Markiert anfällige Code-Stellen direkt in der "Project Review" im Dashboard.

## 3. Community- & Chat-Funktionen
- Chatsystem mit rollenbasierter Rechteverwaltung (Admin, Moderator, Bughunter, Arbeiter).
- Einladungslinks generieren.
- "Vorstellungs-Slides" für neue Mitglieder, die sich dem Team anschließen.

## 4. MCP-Verbesserungen
- Zusätzliche Tools für Agenten zum direkten Auslösen der Repositories-Checks (z. B. `trigger_repo_scan`).
- Erweiterte Rechteverwaltung für KI (Bestätigungs-Dialog, bevor Code committet wird).

## 5. Security-Checks (Man-in-the-Middle)
- Immer den User fragen, wenn sicherheitskritische Operationen anstehen (API-Keys verwalten, Endpunkte freischalten).
