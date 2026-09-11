# Installing VibeWorks

<p><a href="INSTALLATION.md">🇩🇪 Deutsch</a> · <b>🇬🇧 English</b></p>

VibeWorks is self-hosted on your own server. The easiest way is a Proxmox VE container that
is created with a single command.

## Quick start on Proxmox VE (8 or 9)

Run this command in the **shell of the Proxmox host** (as root):

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/MoinMornhart/vibeworks/main/install/proxmox.sh)"
```

The installer

1. checks the host (root, Proxmox VE 8/9, `pct`, `pveam`, `whiptail`),
2. asks for **Default install** or **Advanced**,
3. downloads a Debian 13 template if needed (Debian 12 if there is none),
4. creates an unprivileged LXC container and starts it,
5. installs Node.js 24, PostgreSQL, VibeWorks, the `update` command and auto-update inside it,
6. shows the address at the end, e.g. `http://192.168.1.50:3000`.

### Defaults

| Setting      | Default                                    |
|--------------|--------------------------------------------|
| Container ID | next free ID                               |
| Hostname     | `vibeworks`                                |
| System       | Debian 13 (otherwise Debian 12), unprivileged, `nesting=1` |
| CPU / RAM    | 2 cores / 3072 MB (+ 512 MB swap)          |
| Disk         | 10 GB                                      |
| Network      | `vmbr0`, DHCP                              |
| Autostart    | on (`onboot=1`)                            |

Building the app needs a lot of memory, which is why the container gets 3 GB of RAM.

### Advanced mode

Here you can set everything individually: container ID, hostname, cores, RAM, swap, disk,
bridge, static IP with gateway, VLAN tag, template and disk storage, and optionally a root
password. Without a password you get into the container with `pct enter <CTID>`.

### Testing another branch

```bash
VIBEWORKS_REF=dev bash -c "$(curl -fsSL https://raw.githubusercontent.com/MoinMornhart/vibeworks/dev/install/proxmox.sh)"
```

`VIBEWORKS_REPO` sets a different Git repository (for example a fork).

## Installing without Proxmox (Debian 12/13, Ubuntu 24.04)

On a fresh system as root:

```bash
apt-get update && apt-get install -y curl
curl -fsSL https://raw.githubusercontent.com/MoinMornhart/vibeworks/main/install/vibeworks-install.sh | bash
```

The script can safely be run again. A second run repairs the installation without overwriting
data or configuration.

### Where things live

```
/opt/vibeworks/
  repo/                 Git clone (only used to fetch new versions)
  releases/<commit>/    built versions (the last 3 are kept)
  current  -> releases/<commit>   active version
  previous -> releases/<commit>   previous version (for rollback)
  shared/.env           configuration
  shared/data/          uploads and database backups
  shared/update.conf    branch that updates follow (default: main)
```

The configuration is in `/opt/vibeworks/shared/.env` (`DATABASE_URL`, `APP_SECRET`,
`APP_URL`, `APP_NAME`, `PORT`, `DATA_DIR`, `NODE_ENV`). After a change:
`systemctl restart vibeworks`.

Optional settings for the Git integration:

| Variable | Effect |
| --- | --- |
| `GIT_SYNC_INTERVAL_MIN` | Background sync interval for commits and issues in minutes (default 5) |
| `GIT_SYNC_DISABLED=true` | Turn the background sync off |
| `GIT_ALLOW_LOOPBACK=true` | Allow a Git server on the same machine (localhost) |
| `GIT_BLOCK_PRIVATE=true` | Block Git servers in the private network (allowed by default for self-hosted Gitea) |

## The `update` command

The `update` command is available inside the container or on the server. From the Proxmox
host use `pct exec <CTID> -- update` – or simply the host commands described below.

| Command                 | Effect |
|-------------------------|--------|
| `update`                | shows the installed version and the new changes, asks, then updates |
| `update --yes`          | updates without asking |
| `update --check`        | only checks: exit code 0 = up to date, 10 = update available |
| `update --force`        | rebuilds even if there is nothing new |
| `update --ref <REF>`    | builds a specific branch, tag or commit |
| `update --rollback`     | switches back to the previous version |
| `update --status`       | shows version, releases, auto-update, next timer run and service status |
| `update --auto-on/-off` | turns automatic updates on or off |
| `update --domain <URL>` | changes the address (`APP_URL`) and restarts |
| `update --help`         | help |

How an update works:

1. Fetch new commits. If the `update` script itself changed, it updates itself first.
2. Build the new version in its own directory (`npm ci`, `npm run build`).
   **The running version is not touched.** If the build fails, it is discarded.
3. Back up the database, then migrate it (`prisma migrate deploy`).
4. Switch over and restart.
5. Health check (`/api/health`, up to 60 seconds). If it fails, it **automatically switches
   back to the previous version**.

Important: database migrations are not reverted on rollback. That is why a backup is created
before every migration (see below).

`update --ref` builds a version once. Auto-update then follows the branch from
`shared/update.conf` again. To stay on a specific version, run `update --auto-off` first.

## Auto-update

A systemd timer (`vibeworks-autoupdate.timer`) runs `update --auto` every 15 minutes. If there
is nothing new, nothing happens. If there is, the update runs as described above, including
rollback on a failed health check.

```bash
update --auto-off   # turn off
update --auto-on    # turn back on
update --status     # show whether it is active and when the next run is
```

The admin area in the app also has an **Install latest update** button.

## Backups

Before every migration a database dump is written to
`/opt/vibeworks/shared/data/backups/vibeworks-<date>-<commit>.sql.gz`. The last 10 are kept.
Uploaded files are in `/opt/vibeworks/shared/data/uploads/`. A Proxmox backup of the whole
container is worthwhile on top.

Restoring a backup (careful, this overwrites the database):

```bash
systemctl stop vibeworks
sudo -u postgres dropdb vibeworks
sudo -u postgres createdb -O vibeworks vibeworks
zcat /opt/vibeworks/shared/data/backups/<file>.sql.gz | sudo -u postgres psql vibeworks
systemctl start vibeworks
```

## Logs

```bash
journalctl -u vibeworks -f              # the app
journalctl -u vibeworks-autoupdate      # automatic updates
update --status                         # overview
```

## HTTPS and passkeys

Browsers only allow passkeys over **HTTPS** or on `localhost`. Put a reverse proxy with a
certificate in front of VibeWorks and set the new address as `APP_URL` in
`/opt/vibeworks/shared/.env`. Then run `systemctl restart vibeworks`.

Example with [Caddy](https://caddyserver.com/), which fetches the certificate automatically:

```caddyfile
vibeworks.example.com {
    reverse_proxy 192.168.1.50:3000
}
```

Then in `.env`: `APP_URL=https://vibeworks.example.com`

## Uninstalling

In a Proxmox container, deleting the container is enough:
`pct stop <CTID> && pct destroy <CTID>`.

On your own server:

```bash
systemctl disable --now vibeworks.service vibeworks-autoupdate.timer
rm -f /etc/systemd/system/vibeworks.service /etc/systemd/system/vibeworks-autoupdate.*
systemctl daemon-reload
sudo -u postgres dropdb vibeworks && sudo -u postgres dropuser vibeworks
rm -rf /opt/vibeworks /usr/local/lib/vibeworks /usr/local/bin/update /etc/update-motd.d/90-vibeworks
userdel vibeworks
```

Node.js and PostgreSQL stay installed and can be removed with `apt-get purge` if needed.

## The `vibeworks` command on the Proxmox host

So you don't have to switch into the container first, the Proxmox installer installs the
`vibeworks` command on the host. It finds the container by itself (name or tag "vibeworks",
remembered in `/etc/vibeworks/ctid`) and runs the `update` command inside it.

| Command | Effect |
| --- | --- |
| `vibeworks status` | Version, releases, auto-update, service |
| `vibeworks check` | Is there an update? |
| `vibeworks update` | Install the latest version (`--force`, `--ref <ref>` possible) |
| `vibeworks rollback` | Back to the previous release |
| `vibeworks auto on` / `off` | Turn automatic updates on or off |
| `vibeworks domain vibeworks.example.com` | Change the address (`APP_URL`) and restart |
| `vibeworks url` | Show the current address |
| `vibeworks logs` / `logs -f` | Show or follow the log |
| `vibeworks shell` | Switch into the container |
| `vibeworks repair` | Repair the installation in the container (data and `.env` are kept) |
| `vibeworks self-update` | Update the host command itself |

### `update` directly on the Proxmox host

The host also has an `update` command (a link to `vibeworks`). `update` on its own fetches the
latest update; options are passed through to the update command in the container
(`update --status`, `update --rollback`, …). If the update command is missing in the
container, the call repairs the installation automatically.

Add the commands to an existing host and update right away – one command on the host:

```bash
curl -fsSL https://raw.githubusercontent.com/MoinMornhart/vibeworks/main/install/vibeworks-host.sh -o /usr/local/bin/vibeworks && chmod +x /usr/local/bin/vibeworks && ln -sf /usr/local/bin/vibeworks /usr/local/bin/update && update
```
