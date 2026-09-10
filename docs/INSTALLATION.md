# VibeWorks installieren

VibeWorks läuft selbst gehostet auf einem eigenen Server. Am einfachsten ist ein
Proxmox-VE-Container, der mit einem einzigen Befehl entsteht.

## Schnellstart auf Proxmox VE (8 oder 9)

Diesen Befehl in der **Shell des Proxmox-Hosts** (als root) ausführen:

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/MoinMornhart/vibeworks/main/install/proxmox.sh)"
```

Der Installer

1. prüft den Host (root, Proxmox VE 8/9, `pct`, `pveam`, `whiptail`),
2. fragt nach **Standard-Installation** oder **Erweitert**,
3. lädt bei Bedarf ein Debian-13-Template herunter (falls es keins gibt, Debian 12),
4. legt einen unprivilegierten LXC-Container an und startet ihn,
5. installiert darin Node.js 24, PostgreSQL, VibeWorks, den `update`-Befehl und das Auto-Update,
6. zeigt am Ende die Adresse an, z. B. `http://192.168.1.50:3000`.

### Standardwerte

| Einstellung  | Standard                                   |
|--------------|--------------------------------------------|
| Container-ID | nächste freie ID                           |
| Hostname     | `vibeworks`                                |
| System       | Debian 13 (sonst Debian 12), unprivilegiert, `nesting=1` |
| CPU / RAM    | 2 Kerne / 3072 MB (+ 512 MB Swap)          |
| Festplatte   | 10 GB                                      |
| Netzwerk     | `vmbr0`, DHCP                              |
| Autostart    | an (`onboot=1`)                            |

Der Build der App braucht viel Arbeitsspeicher. Deshalb bekommt der Container 3 GB RAM.

### Erweitert-Modus

Hier lässt sich alles einzeln einstellen: Container-ID, Hostname, Kerne, RAM, Swap,
Festplatte, Bridge, statische IP mit Gateway, VLAN-Tag, Template- und
Festplatten-Storage sowie optional ein Root-Passwort. Ohne Passwort kommst du mit
`pct enter <CTID>` in den Container.

### Anderen Branch testen

```bash
VIBEWORKS_REF=dev bash -c "$(curl -fsSL https://raw.githubusercontent.com/MoinMornhart/vibeworks/dev/install/proxmox.sh)"
```

`VIBEWORKS_REPO` legt ein anderes Git-Repository fest (zum Beispiel einen Fork).

## Installation ohne Proxmox (Debian 12/13, Ubuntu 24.04)

Auf einem frischen System als root:

```bash
apt-get update && apt-get install -y curl
curl -fsSL https://raw.githubusercontent.com/MoinMornhart/vibeworks/main/install/vibeworks-install.sh | bash
```

Das Skript lässt sich gefahrlos erneut ausführen. Ein zweiter Lauf repariert die
Installation, ohne Daten oder Konfiguration zu überschreiben.

### Was wo liegt

```
/opt/vibeworks/
  repo/                 Git-Klon (nur zum Abholen neuer Versionen)
  releases/<commit>/    gebaute Versionen (die letzten 3 bleiben erhalten)
  current  -> releases/<commit>   aktive Version
  previous -> releases/<commit>   vorherige Version (für Rollback)
  shared/.env           Konfiguration
  shared/data/          Uploads und Datenbank-Backups
  shared/update.conf    Branch, dem das Update folgt (Standard: main)
```

Die Konfiguration steht in `/opt/vibeworks/shared/.env` (`DATABASE_URL`, `APP_SECRET`,
`APP_URL`, `APP_NAME`, `PORT`, `DATA_DIR`, `NODE_ENV`). Nach einer Änderung:
`systemctl restart vibeworks`.

## Der `update`-Befehl

Der Befehl `update` steht im Container bzw. auf dem Server zur Verfügung. Vom
Proxmox-Host aus geht es mit `pct exec <CTID> -- update`.

| Befehl                  | Wirkung |
|-------------------------|---------|
| `update`                | zeigt die installierte Version und die neuen Änderungen, fragt nach und aktualisiert |
| `update --yes`          | aktualisiert ohne Rückfrage |
| `update --check`        | prüft nur: Exit-Code 0 = aktuell, 10 = Update verfügbar |
| `update --force`        | baut neu, auch wenn es nichts Neues gibt |
| `update --ref <REF>`    | baut einen bestimmten Branch, Tag oder Commit |
| `update --rollback`     | wechselt zurück auf die vorherige Version |
| `update --status`       | zeigt Version, Releases, Auto-Update, nächsten Timer-Lauf und Dienststatus |
| `update --auto-on/-off` | schaltet das automatische Update ein oder aus |
| `update --help`         | Hilfe |

So läuft ein Update ab:

1. Neue Commits abholen. Hat sich das `update`-Skript geändert, aktualisiert es sich zuerst selbst.
2. Die neue Version in einem eigenen Ordner bauen (`npm ci`, `npm run build`).
   **Die laufende Version bleibt dabei unberührt.** Schlägt der Build fehl, wird er verworfen.
3. Die Datenbank sichern und danach migrieren (`prisma migrate deploy`).
4. Umschalten und neu starten.
5. Health-Check (`/api/health`, bis zu 60 Sekunden). Schlägt er fehl, wird
   **automatisch auf die vorherige Version zurückgeschaltet**.

Wichtig: Datenbank-Migrationen werden bei einem Rollback nicht zurückgedreht. Dafür
liegt vor jeder Migration ein Backup bereit (siehe unten).

`update --ref` baut einen Stand einmalig. Das Auto-Update folgt danach wieder dem
Branch aus `shared/update.conf`. Um auf einem bestimmten Stand zu bleiben, vorher
`update --auto-off` ausführen.

## Auto-Update

Ein systemd-Timer (`vibeworks-autoupdate.timer`) ruft alle 15 Minuten `update --auto` auf.
Gibt es nichts Neues, passiert nichts. Gibt es Neues, läuft das Update wie oben
beschrieben, einschließlich Rollback bei einem fehlgeschlagenen Health-Check.

```bash
update --auto-off   # abschalten
update --auto-on    # wieder einschalten
update --status     # anzeigen, ob es aktiv ist und wann der nächste Lauf ist
```

## Backups

Vor jeder Migration landet ein Datenbank-Dump unter
`/opt/vibeworks/shared/data/backups/vibeworks-<datum>-<commit>.sql.gz`. Die letzten 10
bleiben erhalten. Hochgeladene Dateien liegen unter `/opt/vibeworks/shared/data/uploads/`.
Zusätzlich lohnt sich ein Proxmox-Backup des ganzen Containers.

Ein Backup zurückspielen (Achtung, überschreibt die Datenbank):

```bash
systemctl stop vibeworks
sudo -u postgres dropdb vibeworks
sudo -u postgres createdb -O vibeworks vibeworks
zcat /opt/vibeworks/shared/data/backups/<datei>.sql.gz | sudo -u postgres psql vibeworks
systemctl start vibeworks
```

## Logs

```bash
journalctl -u vibeworks -f              # die App
journalctl -u vibeworks-autoupdate      # automatische Updates
update --status                         # Überblick
```

## HTTPS und Passkeys

Passkeys funktionieren im Browser nur über **HTTPS** oder `localhost`. Setze dafür
einen Reverse Proxy mit Zertifikat vor VibeWorks und trage die neue Adresse als
`APP_URL` in `/opt/vibeworks/shared/.env` ein. Danach `systemctl restart vibeworks`.

Beispiel mit [Caddy](https://caddyserver.com/). Caddy holt das Zertifikat automatisch:

```caddyfile
vibeworks.example.de {
    reverse_proxy 192.168.1.50:3000
}
```

In der `.env` dann: `APP_URL=https://vibeworks.example.de`

## Deinstallation

Im Proxmox-Container reicht es, den Container zu löschen:
`pct stop <CTID> && pct destroy <CTID>`.

Auf einem eigenen Server:

```bash
systemctl disable --now vibeworks.service vibeworks-autoupdate.timer
rm -f /etc/systemd/system/vibeworks.service /etc/systemd/system/vibeworks-autoupdate.*
systemctl daemon-reload
sudo -u postgres dropdb vibeworks && sudo -u postgres dropuser vibeworks
rm -rf /opt/vibeworks /usr/local/lib/vibeworks /usr/local/bin/update /etc/update-motd.d/90-vibeworks
userdel vibeworks
```

Node.js und PostgreSQL bleiben installiert und lassen sich bei Bedarf mit `apt-get purge` entfernen.
