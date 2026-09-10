#!/usr/bin/env bash
# =============================================================================
#  VibeWorks – Installer für Proxmox VE 8/9 (läuft auf dem PVE-Host als root)
#
#    bash -c "$(curl -fsSL https://raw.githubusercontent.com/MoinMornhart/vibeworks/main/install/proxmox.sh)"
#
#  Legt einen unprivilegierten Debian-LXC-Container an und installiert darin
#  VibeWorks (Node.js, PostgreSQL, systemd-Dienst, update-Befehl, Auto-Update).
#
#  Optionale Umgebungsvariablen:
#    VIBEWORKS_REF    Branch/Tag/Commit (Standard: main)
#    VIBEWORKS_REPO   Git-Repository (Standard: GitHub-Repo von VibeWorks)
#    VIBEWORKS_RAW    Basis-URL für Rohdateien (Standard: aus dem Repo abgeleitet)
# =============================================================================
set -euo pipefail

VIBEWORKS_REPO="${VIBEWORKS_REPO:-https://github.com/MoinMornhart/vibeworks.git}"
VIBEWORKS_REF="${VIBEWORKS_REF:-main}"
if [[ -z "${VIBEWORKS_RAW:-}" ]]; then
  if [[ "$VIBEWORKS_REPO" =~ github\.com[/:]([^/]+)/([^/]+)$ ]]; then
    VIBEWORKS_RAW="https://raw.githubusercontent.com/${BASH_REMATCH[1]}/${BASH_REMATCH[2]%.git}/${VIBEWORKS_REF}"
  else
    VIBEWORKS_RAW="https://raw.githubusercontent.com/MoinMornhart/vibeworks/${VIBEWORKS_REF}"
  fi
fi

TITLE="VibeWorks-Installer"
BACKTITLE="VibeWorks – Projekt-Kontrollzentrum für Proxmox VE"

# ----------------------------------------------------------------------------
# Ausgabe
# ----------------------------------------------------------------------------
C_RESET=$'\e[0m'; C_BOLD=$'\e[1m'; C_RED=$'\e[31m'; C_GREEN=$'\e[32m'
C_YELLOW=$'\e[33m'; C_BLUE=$'\e[34m'; C_CYAN=$'\e[36m'
step() { printf '\n%s==>%s %s%s%s\n' "$C_BLUE" "$C_RESET" "$C_BOLD" "$*" "$C_RESET"; }
info() { printf '  %s•%s %s\n' "$C_CYAN" "$C_RESET" "$*"; }
ok()   { printf '  %s✔%s %s\n' "$C_GREEN" "$C_RESET" "$*"; }
warn() { printf '  %s!%s %s\n' "$C_YELLOW" "$C_RESET" "$*" >&2; }
die()  { printf '\n%s✖ FEHLER:%s %s\n' "$C_RED" "$C_RESET" "$*" >&2; exit 1; }

CTID=""
CT_CREATED=0
on_exit() {
  local rc=$?
  if [[ $rc -ne 0 && $CT_CREATED -eq 1 ]]; then
    printf '\n%sDie Installation ist fehlgeschlagen.%s Der Container %s bleibt zur Analyse bestehen.\n' \
      "$C_RED" "$C_RESET" "$CTID" >&2
    printf '  Erneut versuchen (im Container):  pct exec %s -- bash -c "curl -fsSL %s/install/vibeworks-install.sh | bash"\n' \
      "$CTID" "$VIBEWORKS_RAW" >&2
    printf '  Container entfernen:              pct stop %s; pct destroy %s\n' "$CTID" "$CTID" >&2
  fi
}
trap on_exit EXIT

header() {
  clear 2>/dev/null || true
  printf '%s%s' "$C_BOLD" "$C_CYAN"
  cat <<'EOF'
 __     ___ _           __        __         _
 \ \   / (_) |__   ___  \ \      / /__  _ __| | _____
  \ \ / /| | '_ \ / _ \  \ \ /\ / / _ \| '__| |/ / __|
   \ V / | | |_) |  __/   \ V  V / (_) | |  |   <\__ \
    \_/  |_|_.__/ \___|    \_/\_/ \___/|_|  |_|\_\___/
EOF
  printf '%s\n        Installer für Proxmox VE\n\n' "$C_RESET"
}

# ----------------------------------------------------------------------------
# whiptail-Helfer (Abbrechen beendet den Installer)
# ----------------------------------------------------------------------------
cancelled() { clear 2>/dev/null || true; printf 'Installation abgebrochen.\n'; exit 0; }

ask_input() {   # ask_input "Frage" "Standardwert"
  local out
  out="$(whiptail --backtitle "$BACKTITLE" --title "$TITLE" --inputbox "$1" 10 70 "$2" 3>&1 1>&2 2>&3)" || cancelled
  printf '%s' "$out"
}

ask_password() {
  local out
  out="$(whiptail --backtitle "$BACKTITLE" --title "$TITLE" --passwordbox "$1" 10 70 3>&1 1>&2 2>&3)" || cancelled
  printf '%s' "$out"
}

ask_number() {  # ask_number "Frage" "Standard" min max
  local val
  while true; do
    val="$(ask_input "$1" "$2")"
    if [[ "$val" =~ ^[0-9]+$ ]] && (( val >= $3 && val <= $4 )); then
      printf '%s' "$val"; return 0
    fi
    whiptail --backtitle "$BACKTITLE" --title "$TITLE" --msgbox "Bitte eine Zahl zwischen $3 und $4 eingeben." 8 60
  done
}

# Auswahl eines Storage für einen Inhaltstyp (vztmpl / rootdir)
pick_storage() {  # pick_storage <content> <bevorzugt> <interaktiv 0/1> <Beschreibung>
  local content="$1" preferred="$2" interactive="$3" label="$4"
  local -a names=() items=()
  local name type status avail _total _used _rest
  while read -r name type status _total _used avail _rest; do
    [[ "$status" == "active" ]] || continue
    names+=("$name")
    items+=("$name" "$type, frei: $(( avail / 1024 / 1024 )) GB" "OFF")
  done < <(pvesm status -content "$content" 2>/dev/null | awk 'NR>1')

  (( ${#names[@]} > 0 )) || die "Kein aktiver Storage für '$content' gefunden (Rechenzentrum → Storage → Inhalt prüfen)."

  local default="${names[0]}" n
  for n in "${names[@]}"; do [[ "$n" == "$preferred" ]] && default="$n"; done

  if [[ "$interactive" -eq 0 || ${#names[@]} -eq 1 ]]; then
    printf '%s' "$default"; return 0
  fi
  local i
  for (( i = 0; i < ${#items[@]}; i += 3 )); do
    [[ "${items[i]}" == "$default" ]] && items[i+2]="ON"
  done
  whiptail --backtitle "$BACKTITLE" --title "$TITLE" --radiolist \
    "$label" 16 70 6 "${items[@]}" 3>&1 1>&2 2>&3 || cancelled
}

ctid_free() { pvesh get /cluster/nextid --vmid "$1" >/dev/null 2>&1; }

# ----------------------------------------------------------------------------
# Prüfungen
# ----------------------------------------------------------------------------
header
[[ $EUID -eq 0 ]] || die "Bitte als root auf dem Proxmox-VE-Host ausführen."
command -v pveversion >/dev/null 2>&1 || die "pveversion nicht gefunden – das ist kein Proxmox-VE-Host."
PVE_MAJOR="$(pveversion | sed -n 's#^pve-manager/\([0-9][0-9]*\)\..*#\1#p')"
case "$PVE_MAJOR" in
  8|9) ok "Proxmox VE $(pveversion | sed -n 's#^pve-manager/\([^ /]*\).*#\1#p') erkannt" ;;
  *)   die "Proxmox VE 8 oder 9 wird benötigt (gefunden: $(pveversion))." ;;
esac
for cmd in pct pveam pvesh pvesm whiptail; do
  command -v "$cmd" >/dev/null 2>&1 || die "Befehl '$cmd' fehlt."
done
[[ "$(dpkg --print-architecture 2>/dev/null)" == "amd64" ]] || die "Nur amd64-Hosts werden unterstützt."

# ----------------------------------------------------------------------------
# Standardwerte
# ----------------------------------------------------------------------------
CTID="$(pvesh get /cluster/nextid)"
CT_HOSTNAME="vibeworks"
CT_CORES=2
CT_RAM=3072
CT_SWAP=512
CT_DISK=10
CT_BRIDGE="vmbr0"
CT_IP="dhcp"
CT_GW=""
CT_VLAN=""
CT_PASSWORD=""
ADVANCED=0

MODE="$(whiptail --backtitle "$BACKTITLE" --title "$TITLE" --menu \
  "Wie soll VibeWorks installiert werden?" 14 70 2 \
  "standard"  "Standard-Installation (empfohlen)" \
  "erweitert" "Erweitert – alle Einstellungen selbst wählen" \
  3>&1 1>&2 2>&3)" || cancelled
[[ "$MODE" == "erweitert" ]] && ADVANCED=1

if [[ $ADVANCED -eq 1 ]]; then
  while true; do
    CTID="$(ask_number "Container-ID (CTID):" "$CTID" 100 999999999)"
    ctid_free "$CTID" && break
    whiptail --backtitle "$BACKTITLE" --title "$TITLE" --msgbox "Die ID $CTID ist bereits vergeben." 8 50
  done
  while true; do
    CT_HOSTNAME="$(ask_input "Hostname:" "$CT_HOSTNAME")"
    [[ "$CT_HOSTNAME" =~ ^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$ ]] && break
    whiptail --backtitle "$BACKTITLE" --title "$TITLE" --msgbox "Ungültiger Hostname (nur Buchstaben, Ziffern, Bindestrich)." 8 60
  done
  CT_CORES="$(ask_number "CPU-Kerne:" "$CT_CORES" 1 128)"
  CT_RAM="$(ask_number "Arbeitsspeicher in MB (für den Build mind. 3072 empfohlen):" "$CT_RAM" 1024 262144)"
  if (( CT_RAM < 3072 )); then
    whiptail --backtitle "$BACKTITLE" --title "$TITLE" --msgbox \
      "Hinweis: Mit weniger als 3072 MB RAM kann der Build der App fehlschlagen." 8 70
  fi
  CT_SWAP="$(ask_number "Swap in MB:" "$CT_SWAP" 0 65536)"
  CT_DISK="$(ask_number "Festplattengröße in GB:" "$CT_DISK" 6 4096)"
  CT_BRIDGE="$(ask_input "Netzwerk-Bridge:" "$CT_BRIDGE")"
  [[ -d "/sys/class/net/$CT_BRIDGE" ]] || warn "Bridge $CT_BRIDGE wurde auf diesem Host nicht gefunden."
  if whiptail --backtitle "$BACKTITLE" --title "$TITLE" --yesno \
      "IP-Adresse per DHCP beziehen?\n\n(Nein = statische IP eingeben)" 10 60; then
    CT_IP="dhcp"
  else
    while true; do
      CT_IP="$(ask_input "Statische IP mit Präfix (z. B. 192.168.1.50/24):" "")"
      [[ "$CT_IP" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}/[0-9]{1,2}$ ]] && break
      whiptail --backtitle "$BACKTITLE" --title "$TITLE" --msgbox "Bitte im Format 192.168.1.50/24 eingeben." 8 60
    done
    while true; do
      CT_GW="$(ask_input "Gateway (z. B. 192.168.1.1):" "")"
      [[ "$CT_GW" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]] && break
      whiptail --backtitle "$BACKTITLE" --title "$TITLE" --msgbox "Bitte eine gültige IPv4-Adresse eingeben." 8 60
    done
  fi
  while true; do
    CT_VLAN="$(ask_input "VLAN-Tag (leer = kein VLAN):" "")"
    [[ -z "$CT_VLAN" || ( "$CT_VLAN" =~ ^[0-9]+$ && CT_VLAN -ge 1 && CT_VLAN -le 4094 ) ]] && break
    whiptail --backtitle "$BACKTITLE" --title "$TITLE" --msgbox "VLAN-Tag muss zwischen 1 und 4094 liegen." 8 60
  done
  while true; do
    CT_PASSWORD="$(ask_password "Root-Passwort für den Container (leer = keins, Zugang über 'pct enter $CTID'):")"
    [[ -z "$CT_PASSWORD" ]] && break
    if (( ${#CT_PASSWORD} < 5 )); then
      whiptail --backtitle "$BACKTITLE" --title "$TITLE" --msgbox "Das Passwort muss mindestens 5 Zeichen haben." 8 60
      continue
    fi
    [[ "$(ask_password "Passwort wiederholen:")" == "$CT_PASSWORD" ]] && break
    whiptail --backtitle "$BACKTITLE" --title "$TITLE" --msgbox "Die Passwörter stimmen nicht überein." 8 60
  done
fi

TPL_STORAGE="$(pick_storage vztmpl local "$ADVANCED" "Storage für das Container-Template:")"
ROOT_STORAGE="$(pick_storage rootdir local-lvm "$ADVANCED" "Storage für die Container-Festplatte:")"

NET_DESC="DHCP"
[[ "$CT_IP" != "dhcp" ]] && NET_DESC="$CT_IP, Gateway $CT_GW"
[[ -n "$CT_VLAN" ]] && NET_DESC+=", VLAN $CT_VLAN"

whiptail --backtitle "$BACKTITLE" --title "$TITLE" --yesno "VibeWorks wird mit diesen Einstellungen installiert:

  Container-ID:   $CTID
  Hostname:       $CT_HOSTNAME
  CPU / RAM:      $CT_CORES Kerne / $CT_RAM MB (Swap $CT_SWAP MB)
  Festplatte:     $CT_DISK GB auf $ROOT_STORAGE
  Netzwerk:       $CT_BRIDGE, $NET_DESC
  Template von:   $TPL_STORAGE
  Stand:          $VIBEWORKS_REF

Fortfahren?" 20 72 || cancelled

header

# ----------------------------------------------------------------------------
# Template
# ----------------------------------------------------------------------------
step "Suche Debian-Template"
pveam update >/dev/null 2>&1 || warn "Template-Liste konnte nicht aktualisiert werden – nutze vorhandene Liste."

find_template() {  # find_template <debian-version>
  local ver="$1" pattern
  pattern="^debian-${ver}-standard_[0-9.]+-[0-9]+_amd64\.tar\.(zst|xz|gz)$"
  # Bereits heruntergeladen?
  pveam list "$TPL_STORAGE" 2>/dev/null | awk 'NR>1{print $1}' | sed 's#^.*vztmpl/##' \
    | grep -E "$pattern" | sort -V | tail -n 1 || true
}
find_available() {
  local ver="$1"
  pveam available --section system 2>/dev/null | awk '{print $2}' \
    | grep -E "^debian-${ver}-standard_[0-9.]+-[0-9]+_amd64\.tar\.(zst|xz|gz)$" | sort -V | tail -n 1 || true
}

TEMPLATE=""
for ver in 13 12; do
  avail="$(find_available "$ver")"
  local_tpl="$(find_template "$ver")"
  if [[ -n "$avail" ]]; then
    TEMPLATE="$avail"
    if [[ "$local_tpl" != "$avail" ]]; then
      info "Lade $avail herunter ..."
      pveam download "$TPL_STORAGE" "$avail" >/dev/null || die "Download des Templates $avail ist fehlgeschlagen."
    fi
    break
  elif [[ -n "$local_tpl" ]]; then
    TEMPLATE="$local_tpl"
    break
  fi
  [[ "$ver" == "13" ]] && warn "Kein Debian-13-Template verfügbar – versuche Debian 12."
done
[[ -n "$TEMPLATE" ]] || die "Kein Debian-Template (13 oder 12) gefunden."
ok "Template: $TEMPLATE"

# ----------------------------------------------------------------------------
# Container anlegen
# ----------------------------------------------------------------------------
step "Lege Container $CTID an"
ctid_free "$CTID" || die "Die Container-ID $CTID ist inzwischen vergeben."

NET0="name=eth0,bridge=${CT_BRIDGE},ip=${CT_IP}"
[[ -n "$CT_GW" ]] && NET0+=",gw=${CT_GW}"
[[ -n "$CT_VLAN" ]] && NET0+=",tag=${CT_VLAN}"

CREATE_ARGS=(
  "$CTID" "${TPL_STORAGE}:vztmpl/${TEMPLATE}"
  --hostname "$CT_HOSTNAME"
  --cores "$CT_CORES"
  --memory "$CT_RAM"
  --swap "$CT_SWAP"
  --rootfs "${ROOT_STORAGE}:${CT_DISK}"
  --net0 "$NET0"
  --unprivileged 1
  --features nesting=1
  --onboot 1
  --ostype debian
  --tags vibeworks
  --description "VibeWorks – wird installiert ..."
)
[[ -n "$CT_PASSWORD" ]] && CREATE_ARGS+=(--password "$CT_PASSWORD")

pct create "${CREATE_ARGS[@]}" >/dev/null || die "pct create ist fehlgeschlagen."
CT_CREATED=1
ok "Container $CTID angelegt."

step "Starte Container"
pct start "$CTID"
info "Warte auf Netzwerk ..."
net_ok=0
for _ in $(seq 1 60); do
  if pct exec "$CTID" -- getent hosts deb.debian.org >/dev/null 2>&1; then
    net_ok=1; break
  fi
  sleep 2
done
[[ $net_ok -eq 1 ]] || die "Der Container hat nach 120 Sekunden kein Netzwerk/DNS. Bridge, DHCP bzw. Gateway prüfen."
ok "Netzwerk bereit."

# ----------------------------------------------------------------------------
# VibeWorks im Container installieren
# ----------------------------------------------------------------------------
step "Installiere curl im Container"
pct exec "$CTID" -- env DEBIAN_FRONTEND=noninteractive LC_ALL=C.UTF-8 bash -c \
  "apt-get update -qq && apt-get install -y -qq curl ca-certificates >/dev/null" \
  || die "Paketinstallation im Container fehlgeschlagen."
ok "curl installiert."

step "Installiere VibeWorks im Container (Build dauert einige Minuten)"
pct exec "$CTID" -- env \
  VIBEWORKS_REF="$VIBEWORKS_REF" \
  VIBEWORKS_REPO="$VIBEWORKS_REPO" \
  LC_ALL=C.UTF-8 \
  bash -c "curl -fsSL '${VIBEWORKS_RAW}/install/vibeworks-install.sh' | bash" \
  || die "Die Installation im Container ist fehlgeschlagen."

# ----------------------------------------------------------------------------
# Abschluss
# ----------------------------------------------------------------------------
CT_ADDR="$(pct exec "$CTID" -- hostname -I 2>/dev/null | awk '{print $1}')"
APP_URL="http://${CT_ADDR:-<IP-des-Containers>}:3000"

pct set "$CTID" -description "# VibeWorks

Selbst gehostetes Projekt-Kontrollzentrum.

- Web-Oberfläche: [${APP_URL}](${APP_URL})
- Aktualisieren: im Container \`update\` (Hilfe: \`update --help\`)
- Konfiguration: \`/opt/vibeworks/shared/.env\`
- Quellcode: https://github.com/MoinMornhart/vibeworks
" >/dev/null 2>&1 || warn "Container-Beschreibung konnte nicht gesetzt werden."

trap - EXIT
printf '\n%s%s✔ VibeWorks ist bereit!%s\n\n' "$C_GREEN" "$C_BOLD" "$C_RESET"
printf '  Container:   %s (%s)\n' "$CTID" "$CT_HOSTNAME"
printf '  Adresse:     %s%s%s\n\n' "$C_BOLD" "$APP_URL" "$C_RESET"
printf '  Aktualisieren:   pct exec %s -- update      (oder im Container: update)\n' "$CTID"
printf '  Auto-Update:     alle 15 Minuten, abschalten mit: update --auto-off\n'
printf '  Status:          pct exec %s -- update --status\n\n' "$CTID"
printf '%sHinweis:%s Passkeys funktionieren nur über HTTPS oder localhost – für Passkeys einen\n' "$C_YELLOW" "$C_RESET"
printf 'Reverse Proxy mit Zertifikat davorsetzen und APP_URL anpassen (/opt/vibeworks/shared/.env).\n\n'
