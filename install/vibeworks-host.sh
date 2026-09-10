#!/usr/bin/env bash
# =============================================================================
#  VibeWorks – Befehl „vibeworks“ für den Proxmox-VE-Host
#  Steuert den VibeWorks-Container vom Host aus, ohne erst hineinzuwechseln.
#
#  Installation auf dem Host (macht der Proxmox-Installer automatisch):
#    curl -fsSL https://raw.githubusercontent.com/MoinMornhart/vibeworks/main/install/vibeworks-host.sh \
#      -o /usr/local/bin/vibeworks && chmod +x /usr/local/bin/vibeworks
# =============================================================================
set -euo pipefail

RAW="${VIBEWORKS_RAW:-https://raw.githubusercontent.com/MoinMornhart/vibeworks/main}"
CTID_FILE="/etc/vibeworks/ctid"
UPDATE="/usr/local/bin/update"

if [[ -t 1 ]]; then
  C_RED=$'\e[31m'; C_GREEN=$'\e[32m'; C_YELLOW=$'\e[33m'; C_BOLD=$'\e[1m'; C_RESET=$'\e[0m'
else
  C_RED=""; C_GREEN=""; C_YELLOW=""; C_BOLD=""; C_RESET=""
fi
die()  { printf '%sFehler:%s %s\n' "$C_RED" "$C_RESET" "$*" >&2; exit 1; }
ok()   { printf '%s✔%s %s\n' "$C_GREEN" "$C_RESET" "$*"; }
note() { printf '%s!%s %s\n' "$C_YELLOW" "$C_RESET" "$*"; }

usage() {
  cat <<EOF
${C_BOLD}vibeworks${C_RESET} – VibeWorks vom Proxmox-Host aus steuern

  vibeworks status              Version, Releases, Auto-Update, Dienst
  vibeworks check               Gibt es ein Update?
  vibeworks update [OPTIONEN]   Neueste Version installieren (z. B. --force, --ref v0.2.0)
  vibeworks rollback            Zurück auf den vorherigen Stand
  vibeworks auto on|off         Automatische Updates ein- oder ausschalten
  vibeworks domain <ADRESSE>    Adresse ändern, z. B. vibeworks.example.de
  vibeworks url                 Aktuelle Adresse anzeigen
  vibeworks logs [-f|ANZAHL]    Protokoll des Dienstes (-f = mitlesen)
  vibeworks shell               In den Container wechseln
  vibeworks repair              Installation im Container reparieren
  vibeworks self-update         Diesen Befehl selbst aktualisieren

Der Container wird automatisch gefunden (Name oder Tag „vibeworks“).
Festlegen:  echo <CTID> > ${CTID_FILE}   oder   VIBEWORKS_CTID=<CTID> vibeworks …
Im Container selbst heißt der Befehl „update“ (Hilfe: update --help).
EOF
}

case "${1:-help}" in
  help|-h|--help) usage; exit 0 ;;
esac

[[ $EUID -eq 0 ]] || die "Bitte als root auf dem Proxmox-Host ausführen."
command -v pct >/dev/null 2>&1 || die "pct nicht gefunden – das ist kein Proxmox-VE-Host. Im Container heißt der Befehl „update“."

# ── Container finden ──────────────────────────────────────────
find_ctid() {
  local id name
  local -a found=()
  if [[ -n "${VIBEWORKS_CTID:-}" ]]; then
    printf '%s' "$VIBEWORKS_CTID"
    return 0
  fi
  if [[ -r "$CTID_FILE" ]]; then
    id="$(tr -cd '0-9' < "$CTID_FILE")"
    if [[ -n "$id" ]] && pct status "$id" >/dev/null 2>&1; then
      printf '%s' "$id"
      return 0
    fi
  fi
  while read -r id name; do
    [[ -n "$id" ]] || continue
    if [[ "$name" == *vibeworks* ]] || pct config "$id" 2>/dev/null | grep -qE '^tags:.*vibeworks'; then
      found+=("$id")
    fi
  done < <(pct list 2>/dev/null | awk 'NR>1 {print $1, $NF}')
  case ${#found[@]} in
    0) die "Kein VibeWorks-Container gefunden. Container-ID festlegen: echo <CTID> > $CTID_FILE" ;;
    1)
      install -d -m 0755 "$(dirname "$CTID_FILE")"
      printf '%s\n' "${found[0]}" > "$CTID_FILE"
      printf '%s' "${found[0]}"
      ;;
    *) die "Mehrere Kandidaten gefunden (${found[*]}). Bitte festlegen: echo <CTID> > $CTID_FILE" ;;
  esac
}

CTID="$(find_ctid)" || exit 1

if [[ "$(pct status "$CTID" 2>/dev/null | awk '{print $2}')" != "running" ]]; then
  note "Container $CTID läuft nicht – starte ihn …"
  pct start "$CTID"
  for _ in $(seq 1 30); do
    pct exec "$CTID" -- true >/dev/null 2>&1 && break
    sleep 1
  done
fi

in_ct() { pct exec "$CTID" -- "$@"; }

need_update() {
  in_ct test -x "$UPDATE" || die "Im Container $CTID fehlt der update-Befehl – die Installation ist unvollständig. Reparieren mit: vibeworks repair"
}

# ── Befehle ───────────────────────────────────────────────────
cmd="$1"
shift
case "$cmd" in
  status)   need_update; in_ct "$UPDATE" --status ;;
  check)    need_update; in_ct "$UPDATE" --check ;;
  update)   need_update; in_ct "$UPDATE" --yes "$@" ;;
  rollback) need_update; in_ct "$UPDATE" --rollback --yes ;;
  auto)
    need_update
    case "${1:-}" in
      on)  in_ct "$UPDATE" --auto-on ;;
      off) in_ct "$UPDATE" --auto-off ;;
      *)   die "Aufruf: vibeworks auto on|off" ;;
    esac
    ;;
  domain)
    [[ -n "${1:-}" ]] || die "Aufruf: vibeworks domain vibeworks.example.de"
    need_update
    in_ct "$UPDATE" --domain "$1"
    ;;
  url)      in_ct grep -E '^APP_URL=' /opt/vibeworks/shared/.env | cut -d= -f2- ;;
  logs)
    if [[ "${1:-}" == "-f" ]]; then
      in_ct journalctl -u vibeworks -f
    else
      in_ct journalctl -u vibeworks -n "${1:-100}" --no-pager
    fi
    ;;
  shell|enter) exec pct enter "$CTID" ;;
  repair)
    ok "Repariere die Installation im Container $CTID (Daten und .env bleiben erhalten) …"
    in_ct bash -c "command -v curl >/dev/null 2>&1 || { apt-get update -qq && apt-get install -y -qq curl ca-certificates >/dev/null; }; curl -fsSL '$RAW/install/vibeworks-install.sh' | bash"
    ;;
  self-update)
    tmp="$(mktemp)"
    curl -fsSL "$RAW/install/vibeworks-host.sh" -o "$tmp" || die "Download fehlgeschlagen."
    bash -n "$tmp" || die "Die neue Version hat Syntaxfehler – behalte die alte."
    install -m 0755 "$tmp" "$(command -v vibeworks || echo /usr/local/bin/vibeworks)"
    rm -f "$tmp"
    ok "vibeworks ist aktuell."
    ;;
  *) die "Unbekannter Befehl: $cmd (Hilfe: vibeworks help)" ;;
esac
