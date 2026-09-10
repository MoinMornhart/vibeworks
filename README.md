<div align="center">

# VibeWorks

**Das selbst gehostete Kontrollzentrum für deine Vibe-Coding-Projekte.**

<sub>Next.js 15 · TypeScript · Tailwind CSS 4 · Prisma · PostgreSQL</sub>

</div>

---

Beim Vibe Coding entstehen schnell viele halbfertige Projekte: hier ein Repo, dort eine Idee,
irgendwo eine Notiz. VibeWorks sammelt alles an einem Ort auf deinem eigenen Server – Ideen,
Status, Notizen, Aufgaben und (ab Etappe 2) Live-Daten aus deinen Git-Repositories.

Und es sieht so aus, wie **du** willst: Jedes Konto gestaltet sein eigenes Design mit animierten
Hintergründen (Nebel, Sternenhimmel, Polarlicht, Partikelnetz, Wellen, Synthwave …), einem
eigenen Farbverlauf oder einem eigenen Bild, dazu Akzentfarbe, komplette Farbpalette,
Hell-/Dunkelmodus und regelbarem Glas-Effekt.

## Installation auf Proxmox

Auf dem Proxmox-VE-Host ausführen:

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/MoinMornhart/vibeworks/main/install/proxmox.sh)"
```

Das Skript legt einen Debian-LXC-Container an, installiert Node.js, PostgreSQL und VibeWorks
und richtet das automatische Update ein. Details stehen in [docs/INSTALLATION.md](docs/INSTALLATION.md).

### Befehle

Auf dem **Proxmox-Host** (richtet der Installer ein):

```bash
vibeworks status                         # Version, Releases, Auto-Update, Dienst
vibeworks update                         # neueste Version installieren
vibeworks domain vibeworks.example.de    # Adresse ändern
vibeworks repair                         # Installation im Container reparieren
vibeworks help                           # alle Befehle
```

Auf dem Host gibt es dazu die Abkürzung **`update`** (= `vibeworks update`, auch
`update --status` usw.). Nachrüsten auf einem bestehenden Host – installiert die Befehle
und holt sofort das neueste Update (eine unvollständige Installation wird dabei repariert):

```bash
curl -fsSL https://raw.githubusercontent.com/MoinMornhart/vibeworks/main/install/vibeworks-host.sh -o /usr/local/bin/vibeworks && chmod +x /usr/local/bin/vibeworks && ln -sf /usr/local/bin/vibeworks /usr/local/bin/update && update
```

Im **Container** heißt der Befehl `update` (`update --status`, `update --rollback`,
`update --domain …`, `update --help`). Außerdem gibt es im Admin-Bereich einen Knopf
„Neuestes Update installieren“.

Der Server prüft zusätzlich **alle 15 Minuten** selbst auf neue Versionen. Jede Version wird in
einem eigenen Verzeichnis gebaut; erst wenn der Build klappt und die App danach gesund antwortet,
wird umgeschaltet – sonst bleibt bzw. springt alles automatisch auf den letzten funktionierenden
Stand zurück.

## Entwicklung

```bash
npm install
npm run setup          # .env mit zufälligem APP_SECRET anlegen
npm run db:migrate     # Schema in die PostgreSQL aus DATABASE_URL einspielen
npm run dev            # → http://localhost:3000
```

| Skript | Zweck |
| --- | --- |
| `npm run dev` | Entwicklungsserver |
| `npm run build` / `npm start` | Produktionsbuild und -start |
| `npm run typecheck` | TypeScript prüfen |
| `npm test` | Unit-Tests (Vitest) |
| `npm run version:bump` | Version um eine Stufe erhöhen |

### Versionsschema

Versionen zählen wie ein Zählwerk mit Übertrag bei 9:
`0.0.1 → 0.0.2 → … → 0.0.9 → 0.1.0 → … → 0.9.9 → 1.0.0`.
Jede ausgelieferte Änderung erhöht die Version um eine Stufe und bekommt einen Eintrag im
Änderungsverlauf (`src/lib/changelog.ts`), der in der App angezeigt wird.

## Fahrplan

- **Etappe 1** – Grundgerüst, Anmeldung (Passwort, Passkeys, Zwei-Faktor), Einzel- und
  Mehrbenutzerbetrieb, Projekte, Notizen, Aufgaben, persönliches Design, Proxmox-Installer
  und Auto-Update
- **Etappe 2** – Git-Anbindung (GitHub, GitLab, Gitea), Abgleich, CI-Status, Webhooks,
  Aufgaben ↔ Issues
- **Etappe 3** – Wochenrückblick, Zeitleiste, Projektvorlagen, Import/Export,
  Benachrichtigungen (ntfy, Webhook, E-Mail)

## Danksagung

Die Idee und der Funktionsumfang sind von [Nebula](https://git.wilde-server.de/florian.wilde/nebula)
von Florian Wilde inspiriert. VibeWorks ist eine eigenständige Neuentwicklung.

## Lizenz

MIT – siehe [LICENSE](LICENSE).
