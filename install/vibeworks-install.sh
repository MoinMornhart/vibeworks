#!/usr/bin/env bash
# =============================================================================
#  VibeWorks – Installation auf Debian 12/13 oder Ubuntu 24.04 (als root)
#  Läuft im Proxmox-Container (über install/proxmox.sh) oder direkt auf einem
#  frischen System:
#    curl -fsSL https://raw.githubusercontent.com/MoinMornhart/vibeworks/main/install/vibeworks-install.sh | bash
#  Mehrfach ausführbar: ein zweiter Lauf repariert die Installation.
# =============================================================================
set -euo pipefail

# Das ganze Skript steht in einem { ... }-Block: Bash liest ihn beim Aufruf per
# "curl | bash" komplett ein, bevor etwas läuft, und alle Befehle bekommen
# /dev/null als Eingabe (kein Befehl kann versehentlich das Skript "aufessen").
{

VIBEWORKS_REPO="${VIBEWORKS_REPO:-https://github.com/MoinMornhart/vibeworks.git}"
REF_EXPLICIT="${VIBEWORKS_REF:-}"
VIBEWORKS_REF="${VIBEWORKS_REF:-main}"

BASE_DIR="/opt/vibeworks"
REPO_DIR="$BASE_DIR/repo"
SHARED_DIR="$BASE_DIR/shared"
DATA_DIR="$SHARED_DIR/data"
ENV_FILE="$SHARED_DIR/.env"
UPDATE_CONF="$SHARED_DIR/update.conf"
LIB_DIR="/usr/local/lib/vibeworks"
APP_USER="vibeworks"
DB_NAME="vibeworks"
DB_USER="vibeworks"
NODE_MAJOR=24

export DEBIAN_FRONTEND=noninteractive
export LC_ALL=C.UTF-8

# ----------------------------------------------------------------------------
# Ausgabe
# ----------------------------------------------------------------------------
if [[ -t 1 ]]; then
  C_RESET=$'\e[0m'; C_BOLD=$'\e[1m'; C_RED=$'\e[31m'; C_GREEN=$'\e[32m'
  C_YELLOW=$'\e[33m'; C_BLUE=$'\e[34m'
else
  C_RESET=""; C_BOLD=""; C_RED=""; C_GREEN=""; C_YELLOW=""; C_BLUE=""
fi
step()  { printf '\n%s==>%s %s%s%s\n' "$C_BLUE" "$C_RESET" "$C_BOLD" "$*" "$C_RESET"; }
info()  { printf '%s[i]%s %s\n' "$C_BLUE" "$C_RESET" "$*"; }
ok()    { printf '%s[OK]%s %s\n' "$C_GREEN" "$C_RESET" "$*"; }
warn()  { printf '%s[WARNUNG]%s %s\n' "$C_YELLOW" "$C_RESET" "$*" >&2; }
die()   { printf '%s[FEHLER]%s %s\n' "$C_RED" "$C_RESET" "$*" >&2; exit 1; }

on_exit() {
  local rc=$?
  if [[ $rc -ne 0 ]]; then
    printf '%s[FEHLER]%s Installation abgebrochen (Code %s). Ein erneuter Lauf setzt die Installation fort.\n' \
      "$C_RED" "$C_RESET" "$rc" >&2
  fi
}
trap on_exit EXIT

# ----------------------------------------------------------------------------
# Voraussetzungen
# ----------------------------------------------------------------------------
[[ $EUID -eq 0 ]] || die "Bitte als root ausführen."
[[ -r /etc/os-release ]] || die "/etc/os-release fehlt – unbekanntes System."

# shellcheck disable=SC1091
. /etc/os-release
case "${ID:-}:${VERSION_ID:-}" in
  debian:12|debian:13|ubuntu:24.04) ok "System: ${PRETTY_NAME:-$ID $VERSION_ID}" ;;
  *) warn "Nicht getestetes System (${PRETTY_NAME:-unbekannt}) – versuche es trotzdem." ;;
esac
command -v apt-get >/dev/null 2>&1 || die "apt-get wurde nicht gefunden – nur Debian/Ubuntu werden unterstützt."
command -v systemctl >/dev/null 2>&1 || die "systemd wird benötigt."

# Liest KEY aus einer .env-Datei (ohne sie auszuführen)
env_get() {
  local key="$1" file="$2" line val
  [[ -r "$file" ]] || return 0
  line="$(grep -E "^[[:space:]]*(export[[:space:]]+)?${key}=" "$file" | tail -n 1 || true)"
  [[ -n "$line" ]] || return 0
  val="${line#*=}"
  if [[ "$val" =~ ^\"(.*)\"$ ]] || [[ "$val" =~ ^\'(.*)\'$ ]]; then
    val="${BASH_REMATCH[1]}"
  fi
  printf '%s' "$val"
}

# Ergänzt KEY=WERT in der .env, falls der Schlüssel fehlt
env_ensure() {
  local key="$1" val="$2"
  if ! grep -qE "^[[:space:]]*(export[[:space:]]+)?${key}=" "$ENV_FILE"; then
    printf '%s=%s\n' "$key" "$val" >> "$ENV_FILE"
    info ".env ergänzt: $key"
  fi
}

psql_admin() { (cd / && runuser -u postgres -- psql -v ON_ERROR_STOP=1 -qtA "$@"); }

# ----------------------------------------------------------------------------
# 1. Pakete
# ----------------------------------------------------------------------------
step "Installiere Systempakete"
apt-get update -qq
apt-get install -y -qq curl git ca-certificates gnupg openssl postgresql sudo rsync >/dev/null
ok "Pakete installiert."

# ----------------------------------------------------------------------------
# 2. Node.js über NodeSource
# ----------------------------------------------------------------------------
step "Prüfe Node.js $NODE_MAJOR"
current_major=0
if command -v node >/dev/null 2>&1; then
  current_major="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
fi
if [[ "$current_major" -lt "$NODE_MAJOR" ]]; then
  info "Richte NodeSource-Paketquelle für Node.js $NODE_MAJOR ein ..."
  install -d -m 0755 /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
    | gpg --dearmor --yes -o /etc/apt/keyrings/nodesource.gpg
  chmod 0644 /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${NODE_MAJOR}.x nodistro main" \
    > /etc/apt/sources.list.d/nodesource.list
  cat > /etc/apt/preferences.d/nodesource <<'EOF'
Package: nodejs
Pin: origin deb.nodesource.com
Pin-Priority: 600
EOF
  apt-get update -qq
  apt-get install -y -qq nodejs >/dev/null
fi
command -v node >/dev/null 2>&1 || die "Node.js konnte nicht installiert werden."
ok "Node.js $(node -v), npm $(npm -v)"

# ----------------------------------------------------------------------------
# 3. Systembenutzer und Verzeichnisse
# ----------------------------------------------------------------------------
step "Lege Benutzer und Verzeichnisse an"
if ! id "$APP_USER" >/dev/null 2>&1; then
  useradd --system --home-dir "$BASE_DIR" --no-create-home --shell /usr/sbin/nologin "$APP_USER"
  ok "Systembenutzer $APP_USER angelegt."
fi
install -d -m 0755 -o "$APP_USER" -g "$APP_USER" "$BASE_DIR" "$BASE_DIR/releases"
install -d -m 0750 -o "$APP_USER" -g "$APP_USER" "$SHARED_DIR" "$DATA_DIR" "$DATA_DIR/uploads" "$DATA_DIR/backups"
ok "Verzeichnislayout unter $BASE_DIR bereit."

# ----------------------------------------------------------------------------
# 4. PostgreSQL
# ----------------------------------------------------------------------------
step "Richte PostgreSQL ein"
systemctl enable --now postgresql >/dev/null 2>&1 || true
for _ in $(seq 1 30); do
  if runuser -u postgres -- pg_isready -q 2>/dev/null; then break; fi
  sleep 1
done
runuser -u postgres -- pg_isready -q || die "PostgreSQL startet nicht (journalctl -u postgresql)."

DB_PASS=""
if [[ -f "$ENV_FILE" ]]; then
  existing_url="$(env_get DATABASE_URL "$ENV_FILE")"
  # postgresql://user:pass@host:port/db
  if [[ "$existing_url" =~ ^postgres(ql)?://[^:/@]+:([^@]+)@ ]]; then
    DB_PASS="${BASH_REMATCH[2]}"
  fi
fi
if [[ -z "$DB_PASS" ]]; then
  DB_PASS="$(openssl rand -hex 24)"
fi

if [[ "$(psql_admin -c "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'")" != "1" ]]; then
  psql_admin -c "CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASS//\'/\'\'}'"
  ok "Datenbankrolle $DB_USER angelegt."
else
  # Passwort mit der .env abgleichen (repariert abweichende Zustände)
  psql_admin -c "ALTER ROLE ${DB_USER} WITH LOGIN PASSWORD '${DB_PASS//\'/\'\'}'"
  info "Datenbankrolle $DB_USER existiert bereits – Passwort abgeglichen."
fi
if [[ "$(psql_admin -c "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'")" != "1" ]]; then
  psql_admin -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER} ENCODING 'UTF8' TEMPLATE template0"
  ok "Datenbank $DB_NAME angelegt."
else
  info "Datenbank $DB_NAME existiert bereits."
fi

# ----------------------------------------------------------------------------
# 5. Konfiguration (.env)
# ----------------------------------------------------------------------------
step "Erzeuge Konfiguration"
HOST_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
APP_URL_DEFAULT="http://${HOST_IP:-localhost}:3000"
if [[ ! -f "$ENV_FILE" ]]; then
  umask 077
  cat > "$ENV_FILE" <<EOF
# VibeWorks – Konfiguration (gilt für alle Releases)
# Nach Änderungen: systemctl restart vibeworks
NODE_ENV=production
APP_NAME=VibeWorks
PORT=3000
APP_URL=${APP_URL_DEFAULT}
APP_SECRET=$(openssl rand -hex 32)
DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@127.0.0.1:5432/${DB_NAME}?schema=public
DATA_DIR=${DATA_DIR}
EOF
  umask 022
  ok ".env angelegt: $ENV_FILE"
else
  info ".env existiert bereits – fehlende Werte werden ergänzt."
  env_ensure NODE_ENV production
  env_ensure APP_NAME VibeWorks
  env_ensure PORT 3000
  env_ensure APP_URL "$APP_URL_DEFAULT"
  env_ensure APP_SECRET "$(openssl rand -hex 32)"
  env_ensure DATABASE_URL "postgresql://${DB_USER}:${DB_PASS}@127.0.0.1:5432/${DB_NAME}?schema=public"
  env_ensure DATA_DIR "$DATA_DIR"
fi
chown "$APP_USER:$APP_USER" "$ENV_FILE"
chmod 0600 "$ENV_FILE"

if [[ -n "$REF_EXPLICIT" || ! -f "$UPDATE_CONF" ]]; then
  printf '# Branch, dem der update-Befehl folgt\nBRANCH=%s\n' "$VIBEWORKS_REF" > "$UPDATE_CONF"
  chmod 0644 "$UPDATE_CONF"
fi

# ----------------------------------------------------------------------------
# 6. Repository
# ----------------------------------------------------------------------------
step "Hole den Quellcode ($VIBEWORKS_REPO, $VIBEWORKS_REF)"
g() { git -c safe.directory="$REPO_DIR" -C "$REPO_DIR" "$@"; }
if [[ -d "$REPO_DIR/.git" ]]; then
  g remote set-url origin "$VIBEWORKS_REPO"
  g fetch --prune --tags --force origin
else
  rm -rf "$REPO_DIR"
  git clone --quiet --no-checkout "$VIBEWORKS_REPO" "$REPO_DIR"
fi
chown -R root:root "$REPO_DIR"

REF_SHA=""
for cand in "refs/remotes/origin/$VIBEWORKS_REF" "refs/tags/$VIBEWORKS_REF" "$VIBEWORKS_REF"; do
  if REF_SHA="$(g rev-parse --verify --quiet "${cand}^{commit}")" && [[ -n "$REF_SHA" ]]; then
    break
  fi
  REF_SHA=""
done
[[ -n "$REF_SHA" ]] || die "Stand '$VIBEWORKS_REF' wurde im Repository nicht gefunden."
ok "Stand: ${REF_SHA:0:12}"

# ----------------------------------------------------------------------------
# 7. update-Befehl und systemd-Units
# ----------------------------------------------------------------------------
step "Installiere den update-Befehl"
install -d -m 0755 "$LIB_DIR"
tmp="$(mktemp)"
g show "$REF_SHA:scripts/vibeworks-update.sh" > "$tmp" || die "scripts/vibeworks-update.sh fehlt im Repository."
install -m 0755 "$tmp" "$LIB_DIR/vibeworks-update.sh"
rm -f "$tmp"
cat > /usr/local/bin/update <<EOF
#!/usr/bin/env bash
# VibeWorks – update-Befehl (Wrapper). Hilfe: update --help
exec $LIB_DIR/vibeworks-update.sh "\$@"
EOF
chmod 0755 /usr/local/bin/update
ok "Befehl 'update' installiert."

step "Installiere systemd-Units"
for unit in vibeworks.service vibeworks-autoupdate.service vibeworks-autoupdate.timer vibeworks-control.service vibeworks-control.path; do
  g show "$REF_SHA:install/systemd/$unit" > "/etc/systemd/system/$unit" \
    || die "install/systemd/$unit fehlt im Repository."
  chmod 0644 "/etc/systemd/system/$unit"
done
systemctl daemon-reload
ok "systemd-Units installiert."

# ----------------------------------------------------------------------------
# 8. Ersten Release bauen und starten (gleicher Code wie beim Update)
# ----------------------------------------------------------------------------
step "Baue und starte VibeWorks (das dauert beim ersten Mal einige Minuten)"
VIBEWORKS_UPDATE_REEXEC=1 /usr/local/bin/update --install

systemctl enable --now vibeworks.service >/dev/null 2>&1 || true
if [[ -f "$SHARED_DIR/autoupdate.disabled" ]]; then
  info "Auto-Update ist abgeschaltet (update --auto-on zum Einschalten)."
else
  systemctl enable --now vibeworks-autoupdate.timer >/dev/null 2>&1 || warn "Auto-Update-Timer konnte nicht aktiviert werden."
fi
# Update per Knopfdruck aus der Admin-Oberfläche
systemctl enable --now vibeworks-control.path >/dev/null 2>&1 || warn "vibeworks-control.path konnte nicht aktiviert werden."

# ----------------------------------------------------------------------------
# 9. MOTD-Hinweis
# ----------------------------------------------------------------------------
if [[ -d /etc/update-motd.d ]]; then
  cat > /etc/update-motd.d/90-vibeworks <<'EOF'
#!/bin/sh
url="$(grep -E '^APP_URL=' /opt/vibeworks/shared/.env 2>/dev/null | tail -n 1 | cut -d= -f2-)"
state="$(systemctl is-active vibeworks 2>/dev/null)"
printf '\n  VibeWorks (%s): %s\n' "$state" "${url:-http://$(hostname -I | awk '{print $1}'):3000}"
printf '  Aktualisieren: update   |   Status: update --status   |   Hilfe: update --help\n\n'
EOF
  chmod 0755 /etc/update-motd.d/90-vibeworks
else
  printf '\n  VibeWorks: %s\n  Aktualisieren: update | Status: update --status\n\n' "$APP_URL_DEFAULT" > /etc/motd
fi

# ----------------------------------------------------------------------------
# Fertig
# ----------------------------------------------------------------------------
trap - EXIT
APP_URL_NOW="$(env_get APP_URL "$ENV_FILE")"
printf '\n%s%sVibeWorks ist installiert.%s\n\n' "$C_GREEN" "$C_BOLD" "$C_RESET"
printf '  Adresse:        %s\n' "${APP_URL_NOW:-$APP_URL_DEFAULT}"
printf '  Konfiguration:  %s\n' "$ENV_FILE"
printf '  Daten/Backups:  %s\n' "$DATA_DIR"
printf '  Aktualisieren:  update   (Hilfe: update --help)\n'
printf '  Logs:           journalctl -u vibeworks -f\n\n'
printf '%sHinweis:%s Passkeys funktionieren nur über HTTPS oder localhost – für Passkeys einen\n' "$C_YELLOW" "$C_RESET"
printf 'Reverse Proxy mit Zertifikat davorsetzen und APP_URL in %s anpassen.\n\n' "$ENV_FILE"

} </dev/null
