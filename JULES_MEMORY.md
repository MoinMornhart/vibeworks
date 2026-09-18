# Jules Memory: VibeWorks

## Issue-Handling / Workflow
- **Immer `gh issue list` vor Beginn nutzen**: Aktionen müssen auf echten Github Issues basieren.
- **CLAUDE.md ist heilig**: Sie leitet uns und andere Agenten im Repository an.
- **Workers synchronisieren**: Für Issue-Synchronisierung im VibeWorks Repo (`src/lib/git/issues.ts`) werden Regex für Worker verwendet. Ich habe diese um 'Arbeiter' und 'Bughunter' ergänzt (#102).
- **Proposals dokumentieren**: Längere Analysen für "Verbesserungen" (#103) am besten im `docs/`-Verzeichnis (z. B. `docs/proposals.md`) festhalten.
- **GitHub Permissions**: Bei "Resource not accessible by personal access token" bei Issue Comment / PR API via CLI bedeutet dies, dass das Token zwar gültig ist, aber nicht ausreichend Scopes für Issue-Write (oder Pull Request) besitzt. Der native `submit`-Call springt dann ein.
