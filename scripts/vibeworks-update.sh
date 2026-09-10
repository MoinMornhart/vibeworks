#!/usr/bin/env bash
# =============================================================================
#  VibeWorks – update-Befehl
#  Baut neue Versionen als eigenes Release, migriert die Datenbank, schaltet
#  per Symlink um und rollt bei fehlgeschlagenem Health-Check automatisch
#  zurück. Installiert als /usr/local/lib/vibeworks/vibeworks-update.sh,
#  aufrufbar über den Wrapper /usr/local/bin/update.
# =============================================================================
set -euo pipefail

# ----------------------------------------------------------------------------
# Pfade und Konstanten
# ----------------------------------------------------------------------------
BASE_DIR="/opt/vibeworks"
REPO_DIR="$BASE_DIR/repo"
RELEASES_DIR="$BASE_DIR/releases"
CURRENT_LINK="$BASE_DIR/current"
PREVIOUS_LINK="$BASE_DIR/previous"
SHARED_DIR="$BASE_DIR/shared"
ENV_FILE="$SHARED_DIR/.env"
DATA_DIR_DEFAULT="$SHARED_DIR/data"
UPDATE_CONF="$SHARED_DIR/update.conf"
AUTO_DISABLED_FILE="$SHARED_DIR/autoupdate.disabled"
# Update per Knopfdruck aus der Admin-Oberfläche: Die App (ohne Root) legt
# ihre Anfrage in CONTROL_DIR ab; Status und Log schreibt nur root nach
# STATUS_DIR, die App darf dort lediglich lesen.
CONTROL_DIR="$SHARED_DIR/control"
STATUS_DIR="$SHARED_DIR/status"
INSTALLED_SELF="/usr/local/lib/vibeworks/vibeworks-update.sh"
LOCK_FILE="/run/vibeworks-update.lock"
APP_USER="vibeworks"
SERVICE="vibeworks.service"
TIMER="vibeworks-autoupdate.timer"
BUILT_MARKER=".vibeworks-built"
SHA_FILE=".vibeworks-sha"
KEEP_RELEASES=3
KEEP_BACKUPS=10
HEALTH_TIMEOUT=60
BUILD_NODE_OPTIONS="--max-old-space-size=2048"

# ----------------------------------------------------------------------------
# Ausgabe
# ----------------------------------------------------------------------------
if [[ -t 1 ]]; then
  C_RESET=$'\e[0m'; C_BOLD=$'\e[1m'; C_RED=$'\e[31m'; C_GREEN=$'\e[32m'
  C_YELLOW=$'\e[33m'; C_BLUE=$'\e[34m'; C_DIM=$'\e[2m'
else
  C_RESET=""; C_BOLD=""; C_RED=""; C_GREEN=""; C_YELLOW=""; C_BLUE=""; C_DIM=""
fi

MODE_AUTO=0
QUIET=0

info()  { [[ $QUIET -eq 1 ]] || printf '%s[i]%s %s\n' "$C_BLUE" "$C_RESET" "$*"; }
step()  { printf '%s==>%s %s%s%s\n' "$C_BLUE" "$C_RESET" "$C_BOLD" "$*" "$C_RESET"; }
ok()    { printf '%s[OK]%s %s\n' "$C_GREEN" "$C_RESET" "$*"; }
warn()  { printf '%s[WARNUNG]%s %s\n' "$C_YELLOW" "$C_RESET" "$*" >&2; }
error() { printf '%s[FEHLER]%s %s\n' "$C_RED" "$C_RESET" "$*" >&2; }
die()   { error "$*"; exit 1; }

usage() {
  cat <<'EOF'
VibeWorks – update

Aufruf: update [OPTION]

  (ohne Option)      Zeigt aktuelle Version und neue Änderungen, fragt nach
                     und aktualisiert.
  --yes, -y          Aktualisieren ohne Rückfrage.
  --check            Nur prüfen. Exit 0 = aktuell, Exit 10 = Update verfügbar.
  --auto             Für den Timer: still, wenn nichts neu ist, sonst wie --yes.
                     Wird übersprungen, wenn Auto-Update abgeschaltet ist.
  --force            Auch ohne neue Änderungen neu bauen.
  --ref <REF>        Bestimmten Branch, Tag oder Commit bauen und aktivieren.
  --rollback         Zurück auf den vorherigen Release.
  --auto-on          Automatische Updates einschalten.
  --auto-off         Automatische Updates abschalten.
  --status           Version, Releases, Auto-Update und Dienststatus anzeigen.
  --install          (intern) Ersten Release beim Installieren bauen.
  --domain <ADRESSE> Adresse ändern (APP_URL), z. B. vibeworks.example.de –
                     ohne http(s):// wird https:// angenommen.
  --from-app         (intern) Anfrage aus der Admin-Oberfläche ausführen.
  --help, -h         Diese Hilfe.

Optionen lassen sich kombinieren, z. B.: update --ref main --force --yes
EOF
}

# ----------------------------------------------------------------------------
# Argumente
# ----------------------------------------------------------------------------
ORIG_ARGS=("$@")
ACTION="update"
DOMAIN_ARG=""
ASSUME_YES=0
FORCE=0
REF_OVERRIDE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    -y|--yes)     ASSUME_YES=1 ;;
    --check)      ACTION="check" ;;
    --auto)       ACTION="update"; MODE_AUTO=1; ASSUME_YES=1 ;;
    --force)      FORCE=1 ;;
    --ref)
      [[ $# -ge 2 && -n "$2" ]] || die "--ref braucht einen Wert (Branch, Tag oder Commit)."
      REF_OVERRIDE="$2"; shift ;;
    --ref=*)      REF_OVERRIDE="${1#--ref=}" ;;
    --rollback)   ACTION="rollback" ;;
    --auto-on)    ACTION="auto-on" ;;
    --auto-off)   ACTION="auto-off" ;;
    --status)     ACTION="status" ;;
    --install)    ACTION="install"; ASSUME_YES=1 ;;
    --from-app)   ACTION="from-app"; ASSUME_YES=1 ;;
    --domain)
      [[ $# -ge 2 && -n "$2" ]] || die "--domain braucht eine Adresse, z. B. vibeworks.example.de"
      ACTION="domain"; DOMAIN_ARG="$2"; shift ;;
    -h|--help)    usage; exit 0 ;;
    *)            error "Unbekannte Option: $1"; usage >&2; exit 2 ;;
  esac
  shift
done

# ----------------------------------------------------------------------------
# Grundvoraussetzungen
# ----------------------------------------------------------------------------
if [[ $EUID -ne 0 ]]; then
  if command -v sudo >/dev/null 2>&1; then
    exec sudo -- "$0" "${ORIG_ARGS[@]}"
  fi
  die "Der update-Befehl muss als root laufen."
fi

if [[ ! -d "$BASE_DIR" ]]; then
  die "VibeWorks ist hier nicht installiert ($BASE_DIR fehlt)."
fi
if [[ ! -d "$REPO_DIR/.git" ]]; then
  die "VibeWorks ist hier nicht vollständig installiert ($REPO_DIR fehlt). Installer erneut ausführen."
fi

# Git auf das (root-eigene) Fetch-Repo
g() { git -c safe.directory="$REPO_DIR" -C "$REPO_DIR" "$@"; }

# Sperre gegen parallele Läufe. Nach einem Selbst-Update (exec) bleibt der
# Dateideskriptor 9 samt Sperre erhalten.
acquire_lock() {
  if [[ "${VIBEWORKS_LOCK_HELD:-}" == "1" ]] && { true >&9; } 2>/dev/null; then
    return 0
  fi
  exec 9>"$LOCK_FILE"
  if ! flock -n 9; then
    if [[ $MODE_AUTO -eq 1 ]]; then
      exit 0
    fi
    info "Ein anderer Update-Lauf ist aktiv – warte bis zu 10 Minuten ..."
    flock -w 600 9 || die "Sperre $LOCK_FILE konnte nicht übernommen werden."
  fi
  export VIBEWORKS_LOCK_HELD=1
}

# ----------------------------------------------------------------------------
# Hilfsfunktionen
# ----------------------------------------------------------------------------

# Liest KEY aus einer .env-Datei (ohne sie auszuführen); entfernt Anführungszeichen
env_get() {
  local key="$1" file="${2:-$ENV_FILE}" line val
  [[ -r "$file" ]] || return 0
  line="$(grep -E "^[[:space:]]*(export[[:space:]]+)?${key}=" "$file" | tail -n 1 || true)"
  [[ -n "$line" ]] || return 0
  val="${line#*=}"
  val="${val%$'\r'}"
  if [[ "$val" =~ ^\"(.*)\"$ ]] || [[ "$val" =~ ^\'(.*)\'$ ]]; then
    val="${BASH_REMATCH[1]}"
  fi
  printf '%s' "$val"
}

# Baut ein Array "KEY=WERT" aus der .env, um es per env(1) weiterzugeben
ENV_ARGS=()
load_env_args() {
  ENV_ARGS=()
  [[ -r "$ENV_FILE" ]] || return 0
  local line key val
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%$'\r'}"
    [[ "$line" =~ ^[[:space:]]*(#|$) ]] && continue
    line="${line#"${line%%[![:space:]]*}"}"
    line="${line#export }"
    [[ "$line" == *=* ]] || continue
    key="${line%%=*}"
    val="${line#*=}"
    [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue
    if [[ "$val" =~ ^\"(.*)\"$ ]] || [[ "$val" =~ ^\'(.*)\'$ ]]; then
      val="${BASH_REMATCH[1]}"
    fi
    ENV_ARGS+=("$key=$val")
  done < "$ENV_FILE"
}

app_port() {
  local p
  p="$(env_get PORT)"
  [[ "$p" =~ ^[0-9]+$ ]] || p=3000
  printf '%s' "$p"
}

data_dir() {
  local d
  d="$(env_get DATA_DIR)"
  printf '%s' "${d:-$DATA_DIR_DEFAULT}"
}

# Branch, dem das Auto-Update folgt (update.conf: BRANCH=main)
tracked_branch() {
  local b=""
  [[ -r "$UPDATE_CONF" ]] && b="$(env_get BRANCH "$UPDATE_CONF")"
  printf '%s' "${b:-main}"
}

# Die Version eines Stands ergibt sich aus der Zahl seiner Commits: jedes
# Update zählt eine Stufe weiter, mit Übertrag bei 9 (16 → 0.1.6,
# 100 → 1.0.0) – dieselbe Rechnung wie in scripts/build-info.mjs.
count_version() {
  local n="$1"
  printf '%d.%d.%d' $(( n / 100 )) $(( n / 10 % 10 )) $(( n % 10 ))
}

# Version eines Git-Stands (Branch, Tag oder Commit)
pkg_version_at() {
  local n
  n="$(g rev-list --count "$1" 2>/dev/null)" || { printf '?'; return 0; }
  count_version "$n"
}

# Version eines gebauten Releases – Argument: <release>/package.json.
# Maßgeblich ist der gespeicherte Commit, package.json nur als Notlösung.
pkg_version() {
  local file="$1" sha
  sha="$(release_sha "$(dirname "$file")")"
  if [[ -n "$sha" ]]; then
    pkg_version_at "$sha"
    return 0
  fi
  [[ -r "$file" ]] || { printf '?'; return 0; }
  sed -n 's/^[[:space:]]*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$file" | head -n 1
}

# Aufgelöster Pfad eines Release-Symlinks (leer, wenn nicht vorhanden)
link_target() {
  local link="$1"
  [[ -L "$link" ]] || return 0
  local t
  t="$(readlink -f "$link" || true)"
  [[ -n "$t" && -d "$t" ]] && printf '%s' "$t"
  return 0
}

release_sha() {
  local dir="$1"
  [[ -n "$dir" && -r "$dir/$SHA_FILE" ]] && cat "$dir/$SHA_FILE"
  return 0
}

current_sha() { release_sha "$(link_target "$CURRENT_LINK")"; }

short_sha() { printf '%s' "${1:0:12}"; }

# Löst Branch / Tag / Commit auf einen vollständigen Commit-SHA auf
resolve_ref() {
  local ref="$1" sha=""
  for cand in "refs/remotes/origin/$ref" "refs/tags/$ref" "$ref"; do
    if sha="$(g rev-parse --verify --quiet "${cand}^{commit}" 2>/dev/null)" && [[ -n "$sha" ]]; then
      printf '%s' "$sha"
      return 0
    fi
  done
  return 1
}

fetch_repo() {
  info "Hole Änderungen von $(g remote get-url origin 2>/dev/null || echo origin) ..."
  if ! g fetch --prune --tags --force origin >/dev/null 2>&1; then
    # Zweiter Versuch mit Ausgabe, damit der Fehler sichtbar wird
    g fetch --prune --tags --force origin || die "git fetch ist fehlgeschlagen (Netzwerk/GitHub erreichbar?)."
  fi
}

run_as_app() { runuser -u "$APP_USER" -- "$@"; }

service_exists() { [[ -f "/etc/systemd/system/$SERVICE" ]]; }

health_ok() {
  local port resp
  port="$(app_port)"
  resp="$(curl -fsS --max-time 5 "http://127.0.0.1:${port}/api/health" 2>/dev/null)" || return 1
  [[ "$resp" =~ \"ok\"[[:space:]]*:[[:space:]]*true ]]
}

wait_for_health() {
  local waited=0
  while (( waited < HEALTH_TIMEOUT )); do
    if health_ok; then
      return 0
    fi
    sleep 2
    waited=$(( waited + 2 ))
  done
  return 1
}

restart_service() {
  systemctl daemon-reload
  systemctl enable "$SERVICE" >/dev/null 2>&1 || true
  systemctl restart "$SERVICE"
}

# Symlink atomar umbiegen
switch_link() {
  local link="$1" target="$2"
  local tmp="${link}.tmp.$$"
  ln -sfn "$target" "$tmp"
  mv -T "$tmp" "$link"
}

# systemd-Units aus dem Release übernehmen, falls geändert
sync_units() {
  local release="$1" changed=0 f name
  [[ -d "$release/install/systemd" ]] || return 0
  for f in "$release"/install/systemd/*.service "$release"/install/systemd/*.timer "$release"/install/systemd/*.path; do
    [[ -f "$f" ]] || continue
    name="$(basename "$f")"
    if ! cmp -s "$f" "/etc/systemd/system/$name"; then
      install -m 0644 "$f" "/etc/systemd/system/$name"
      changed=1
      info "systemd-Unit aktualisiert: $name"
    fi
  done
  if [[ $changed -eq 1 ]]; then
    systemctl daemon-reload
  fi
}

# ----------------------------------------------------------------------------
# Selbst-Update
# ----------------------------------------------------------------------------
self_update() {
  local sha="$1" tmp
  [[ "${VIBEWORKS_UPDATE_REEXEC:-}" == "1" ]] && return 0
  tmp="$(mktemp)"
  if ! g show "$sha:scripts/vibeworks-update.sh" > "$tmp" 2>/dev/null; then
    rm -f "$tmp"
    return 0
  fi
  if [[ -f "$INSTALLED_SELF" ]] && cmp -s "$tmp" "$INSTALLED_SELF"; then
    rm -f "$tmp"
    return 0
  fi
  if ! bash -n "$tmp" 2>/dev/null; then
    warn "Neue Version des update-Skripts hat Syntaxfehler – behalte die installierte."
    rm -f "$tmp"
    return 0
  fi
  install -D -m 0755 "$tmp" "$INSTALLED_SELF"
  rm -f "$tmp"
  info "update-Skript wurde aktualisiert – starte neu ..."
  export VIBEWORKS_UPDATE_REEXEC=1
  exec "$INSTALLED_SELF" "${ORIG_ARGS[@]}"
}

# ----------------------------------------------------------------------------
# Release bauen
# ----------------------------------------------------------------------------
BUILD_DIR=""

cleanup_failed_build() {
  local dir="$1" cur prev
  cur="$(link_target "$CURRENT_LINK")"
  prev="$(link_target "$PREVIOUS_LINK")"
  if [[ -n "$dir" && -d "$dir" && "$dir" != "$cur" && "$dir" != "$prev" ]]; then
    rm -rf -- "$dir"
  fi
}

build_release() {
  local sha="$1" short dir
  short="$(short_sha "$sha")"
  dir="$RELEASES_DIR/$short"
  BUILD_DIR="$dir"

  if [[ -f "$dir/$BUILT_MARKER" && "$(release_sha "$dir")" == "$sha" ]]; then
    ok "Release $short ist bereits gebaut – wird wiederverwendet."
    return 0
  fi

  if [[ -e "$dir" ]]; then
    if [[ "$dir" == "$(link_target "$CURRENT_LINK")" ]]; then
      die "Release $short ist aktiv, aber unvollständig. Bitte 'update --rollback' oder 'update --force --ref <anderer Stand>' verwenden."
    fi
    info "Entferne unvollständigen Release $short ..."
    rm -rf -- "$dir"
  fi

  step "Exportiere Stand $short"
  mkdir -p "$dir"
  if ! g archive --format=tar "$sha" | tar -x -C "$dir"; then
    cleanup_failed_build "$dir"
    die "Export des Stands $short ist fehlgeschlagen."
  fi
  printf '%s\n' "$sha" > "$dir/$SHA_FILE"
  ln -sfn "$ENV_FILE" "$dir/.env"
  chown -R "$APP_USER:$APP_USER" "$dir"

  local npm_env=(
    HOME="$BASE_DIR"
    npm_config_cache="$BASE_DIR/.cache/npm"
    npm_config_update_notifier=false
    NEXT_TELEMETRY_DISABLED=1
    CI=1
  )
  mkdir -p "$BASE_DIR/.cache"
  chown "$APP_USER:$APP_USER" "$BASE_DIR/.cache"

  step "Installiere Abhängigkeiten (npm ci)"
  if ! (cd "$dir" && run_as_app env "${npm_env[@]}" NODE_ENV=development \
        npm ci --include=dev --no-audit --no-fund); then
    cleanup_failed_build "$dir"
    error "npm ci ist fehlgeschlagen. Die laufende Version bleibt unverändert aktiv."
    exit 3
  fi

  step "Baue die App (npm run build) – das kann einige Minuten dauern"
  load_env_args
  # Im Release-Ordner gibt es kein .git – die App erfährt Commit und
  # Update-Nummer daher von hier (ausgewertet von scripts/build-info.mjs).
  local build_env=(
    VIBEWORKS_SHA="$sha"
    VIBEWORKS_COMMIT_COUNT="$(g rev-list --count "$sha")"
    VIBEWORKS_COMMIT_DATE="$(g show -s --format=%cI "$sha")"
    VIBEWORKS_REPO_URL="$(g remote get-url origin 2>/dev/null || true)"
  )
  if ! (cd "$dir" && run_as_app env "${ENV_ARGS[@]}" "${npm_env[@]}" "${build_env[@]}" \
        NODE_ENV=production NODE_OPTIONS="$BUILD_NODE_OPTIONS" npm run build); then
    cleanup_failed_build "$dir"
    error "Der Build ist fehlgeschlagen. Die laufende Version bleibt unverändert aktiv."
    exit 3
  fi

  touch "$dir/$BUILT_MARKER"
  chown "$APP_USER:$APP_USER" "$dir/$BUILT_MARKER"
  ok "Release $short gebaut."
}

# ----------------------------------------------------------------------------
# Datenbank
# ----------------------------------------------------------------------------
LAST_BACKUP=""

backup_database() {
  local sha="$1" backups db_url db_name file
  backups="$(data_dir)/backups"
  mkdir -p "$backups"
  chown "$APP_USER:$APP_USER" "$backups"
  chmod 0750 "$backups"
  file="$backups/vibeworks-$(date +%Y%m%d-%H%M%S)-$(short_sha "$sha").sql.gz"

  db_url="$(env_get DATABASE_URL)"
  db_name="${db_url##*/}"
  db_name="${db_name%%\?*}"

  step "Sichere die Datenbank"
  local ok_dump=0
  if [[ -n "$db_name" ]] && id postgres >/dev/null 2>&1 \
     && (cd / && runuser -u postgres -- pg_dump --no-owner "$db_name" 2>/dev/null | gzip -c > "$file.part") \
     && [[ -s "$file.part" ]]; then
    ok_dump=1
  elif [[ -n "$db_url" ]] && (cd / && pg_dump --no-owner "${db_url%%\?*}" 2>/dev/null | gzip -c > "$file.part") \
     && [[ -s "$file.part" ]]; then
    ok_dump=1
  fi

  if [[ $ok_dump -eq 1 ]]; then
    mv "$file.part" "$file"
    chown "$APP_USER:$APP_USER" "$file"
    chmod 0640 "$file"
    LAST_BACKUP="$file"
    ok "Backup: $file"
  else
    rm -f "$file.part"
    die "Datenbank-Backup fehlgeschlagen – Update abgebrochen (laufende Version bleibt aktiv)."
  fi

  # Nur die neuesten Backups behalten
  local old
  while IFS= read -r old; do
    [[ -n "$old" ]] && rm -f -- "$old"
  done < <(ls -1t "$backups"/vibeworks-*.sql.gz 2>/dev/null | tail -n +$(( KEEP_BACKUPS + 1 )))
}

migrate_database() {
  local dir="$1"
  step "Führe Datenbank-Migrationen aus"
  load_env_args
  if ! (cd "$dir" && run_as_app env "${ENV_ARGS[@]}" HOME="$BASE_DIR" \
        npx --no-install prisma migrate deploy); then
    error "Die Datenbank-Migration ist fehlgeschlagen. Die laufende Version bleibt aktiv."
    [[ -n "$LAST_BACKUP" ]] && error "Backup vor der Migration: $LAST_BACKUP"
    exit 4
  fi
  ok "Migrationen angewendet."
}

# ----------------------------------------------------------------------------
# Aufräumen
# ----------------------------------------------------------------------------
cleanup_releases() {
  local cur prev dir kept=0
  cur="$(link_target "$CURRENT_LINK")"
  prev="$(link_target "$PREVIOUS_LINK")"
  # Neueste zuerst (nach Build-Marker bzw. Verzeichnis-Zeit)
  while IFS= read -r dir; do
    [[ -d "$dir" ]] || continue
    if [[ "$dir" == "$cur" || "$dir" == "$prev" ]]; then
      kept=$(( kept + 1 ))
      continue
    fi
    if (( kept < KEEP_RELEASES )) && [[ -f "$dir/$BUILT_MARKER" ]]; then
      kept=$(( kept + 1 ))
      continue
    fi
    info "Entferne alten Release $(basename "$dir")"
    rm -rf -- "$dir"
  done < <(ls -1dt "$RELEASES_DIR"/*/ 2>/dev/null | sed 's#/$##')
}

# ----------------------------------------------------------------------------
# Aktionen
# ----------------------------------------------------------------------------
show_changes() {
  local from="$1" to="$2"
  if [[ -n "$from" ]] && g merge-base --is-ancestor "$from" "$to" 2>/dev/null; then
    local count
    count="$(g rev-list --count "$from..$to")"
    printf '\n%sNeue Änderungen (%s):%s\n' "$C_BOLD" "$count" "$C_RESET"
    g log --oneline --no-decorate -n 20 "$from..$to" | sed 's/^/  /'
    (( count > 20 )) && printf '  %s... und %s weitere%s\n' "$C_DIM" "$(( count - 20 ))" "$C_RESET"
  else
    printf '\n%sZiel-Stand:%s\n' "$C_BOLD" "$C_RESET"
    g log --oneline --no-decorate -n 1 "$to" | sed 's/^/  /'
  fi
  printf '\n'
}

do_update() {
  local target_ref sha cur cur_dir prev_dir short
  acquire_lock

  target_ref="${REF_OVERRIDE:-$(tracked_branch)}"
  if [[ $MODE_AUTO -eq 1 ]]; then QUIET=1; fi
  fetch_repo
  sha="$(resolve_ref "$target_ref")" || die "Stand '$target_ref' wurde im Repository nicht gefunden."
  short="$(short_sha "$sha")"

  cur_dir="$(link_target "$CURRENT_LINK")"
  cur="$(release_sha "$cur_dir")"

  if [[ "$ACTION" == "check" ]]; then
    if [[ "$sha" == "$cur" ]]; then
      echo "VibeWorks ist aktuell ($(short_sha "$cur"))."
      exit 0
    fi
    echo "Update verfügbar: $(short_sha "${cur:-keiner}") -> $short (Version $(pkg_version_at "$sha"))."
    exit 10
  fi

  if [[ "$sha" == "$cur" && $FORCE -eq 0 && "$ACTION" != "install" ]]; then
    if [[ $MODE_AUTO -eq 0 ]]; then
      ok "VibeWorks ist aktuell ($short, Version $(pkg_version "$cur_dir/package.json"))."
    fi
    exit 0
  fi

  # Ab hier gibt es etwas zu tun – auch im Auto-Modus sichtbar protokollieren
  QUIET=0
  self_update "$sha"

  if [[ $MODE_AUTO -eq 1 ]]; then
    info "Auto-Update: $(short_sha "${cur:-keiner}") -> $short"
  fi

  if [[ $ASSUME_YES -eq 0 ]]; then
    printf '%sInstalliert:%s %s (Version %s)\n' "$C_BOLD" "$C_RESET" \
      "$( [[ -n "$cur" ]] && short_sha "$cur" || echo "–")" \
      "$( [[ -n "$cur_dir" ]] && pkg_version "$cur_dir/package.json" || echo "–")"
    printf '%sNeu:%s        %s (Version %s)\n' "$C_BOLD" "$C_RESET" "$short" "$(pkg_version_at "$sha")"
    show_changes "$cur" "$sha"
    if [[ ! -t 0 ]]; then
      die "Keine interaktive Eingabe möglich – mit 'update --yes' ohne Rückfrage aktualisieren."
    fi
    local answer
    read -r -p "Jetzt aktualisieren? [J/n] " answer
    case "${answer,,}" in
      ""|j|ja|y|yes) ;;
      *) info "Abgebrochen."; exit 0 ;;
    esac
  fi

  build_release "$sha"
  local new_dir="$BUILD_DIR"

  # Backup nur, wenn es bereits einen laufenden Stand (und damit Daten) gibt
  if [[ -n "$cur_dir" ]]; then
    backup_database "$sha"
  fi
  migrate_database "$new_dir"
  sync_units "$new_dir"
  ensure_control_setup

  step "Aktiviere Release $short"
  prev_dir="$cur_dir"
  if [[ -n "$prev_dir" && "$prev_dir" != "$new_dir" ]]; then
    switch_link "$PREVIOUS_LINK" "$prev_dir"
  fi
  switch_link "$CURRENT_LINK" "$new_dir"

  if ! service_exists; then
    warn "$SERVICE ist nicht eingerichtet – Dienst wird nicht neu gestartet."
    exit 0
  fi
  restart_service

  step "Prüfe, ob die App antwortet (bis zu ${HEALTH_TIMEOUT} s)"
  if wait_for_health; then
    ok "VibeWorks läuft mit $short (Version $(pkg_version "$new_dir/package.json"))."
    cleanup_releases
    exit 0
  fi

  # Health-Check fehlgeschlagen -> Rollback
  error "Health-Check fehlgeschlagen: http://127.0.0.1:$(app_port)/api/health antwortet nicht mit ok."
  if [[ -n "$prev_dir" && "$prev_dir" != "$new_dir" && -f "$prev_dir/$BUILT_MARKER" ]]; then
    warn "Automatischer Rollback auf $(basename "$prev_dir") ..."
    switch_link "$CURRENT_LINK" "$prev_dir"
    rm -f "$PREVIOUS_LINK"
    restart_service
    if wait_for_health; then
      warn "Rollback erfolgreich – VibeWorks läuft wieder mit $(basename "$prev_dir")."
    else
      error "Auch die vorherige Version antwortet nicht. Logs: journalctl -u vibeworks -n 100"
    fi
    warn "Achtung: Die Datenbank-Migration des neuen Stands wurde bereits ausgeführt."
    [[ -n "$LAST_BACKUP" ]] && warn "Datenbank-Backup von vor dem Update: $LAST_BACKUP"
    warn "Der fehlerhafte Release bleibt zur Analyse unter $new_dir liegen."
  else
    error "Kein vorheriger Release für einen Rollback vorhanden. Logs: journalctl -u vibeworks -n 100"
  fi
  exit 5
}

do_rollback() {
  acquire_lock
  local cur prev
  cur="$(link_target "$CURRENT_LINK")"
  prev="$(link_target "$PREVIOUS_LINK")"
  if [[ -z "$prev" || ! -f "$prev/$BUILT_MARKER" ]]; then
    die "Es gibt keinen vorherigen Release, auf den zurückgerollt werden kann."
  fi
  step "Rollback: $(basename "${cur:-–}") -> $(basename "$prev")"
  if [[ $ASSUME_YES -eq 0 && -t 0 ]]; then
    local answer
    read -r -p "Wirklich zurückrollen? [J/n] " answer
    case "${answer,,}" in
      ""|j|ja|y|yes) ;;
      *) info "Abgebrochen."; exit 0 ;;
    esac
  fi
  switch_link "$CURRENT_LINK" "$prev"
  if [[ -n "$cur" ]]; then
    switch_link "$PREVIOUS_LINK" "$cur"
  fi
  restart_service
  if wait_for_health; then
    ok "Rollback erfolgreich – VibeWorks läuft mit $(basename "$prev")."
    warn "Hinweis: Datenbank-Migrationen werden nicht zurückgedreht. Backups: $(data_dir)/backups"
    if [[ ! -f "$AUTO_DISABLED_FILE" ]]; then
      warn "Auto-Update ist aktiv und installiert beim nächsten Lauf wieder den neuesten Stand."
      warn "Zum Festhalten: update --auto-off"
    fi
  else
    error "Health-Check nach dem Rollback fehlgeschlagen. Logs: journalctl -u vibeworks -n 100"
    exit 5
  fi
}

do_auto_on() {
  rm -f "$AUTO_DISABLED_FILE"
  systemctl enable --now "$TIMER" >/dev/null 2>&1 || warn "Timer $TIMER konnte nicht aktiviert werden."
  ok "Automatische Updates sind eingeschaltet (alle 15 Minuten)."
}

do_auto_off() {
  touch "$AUTO_DISABLED_FILE"
  systemctl disable --now "$TIMER" >/dev/null 2>&1 || true
  ok "Automatische Updates sind abgeschaltet. Manuell aktualisieren mit: update"
}

do_status() {
  local cur prev dir name marks ver
  cur="$(link_target "$CURRENT_LINK")"
  prev="$(link_target "$PREVIOUS_LINK")"

  printf '%sVibeWorks – Status%s\n\n' "$C_BOLD" "$C_RESET"
  if [[ -n "$cur" ]]; then
    printf '  Version:      %s (Commit %s)\n' "$(pkg_version "$cur/package.json")" "$(short_sha "$(release_sha "$cur")")"
  else
    printf '  Version:      – (noch kein Release aktiv)\n'
  fi
  printf '  Branch:       %s\n' "$(tracked_branch)"
  printf '  URL:          %s\n' "$(env_get APP_URL)"
  if [[ -f "$AUTO_DISABLED_FILE" ]]; then
    printf '  Auto-Update:  %saus%s\n' "$C_YELLOW" "$C_RESET"
  else
    printf '  Auto-Update:  %san%s\n' "$C_GREEN" "$C_RESET"
  fi
  printf '  Dienst:       %s\n' "$(systemctl is-active "$SERVICE" 2>/dev/null || true)"
  if health_ok; then
    printf '  Health-Check: %sok%s\n' "$C_GREEN" "$C_RESET"
  else
    printf '  Health-Check: %sfehlgeschlagen%s\n' "$C_RED" "$C_RESET"
  fi

  printf '\n%sReleases:%s\n' "$C_BOLD" "$C_RESET"
  while IFS= read -r dir; do
    [[ -d "$dir" ]] || continue
    name="$(basename "$dir")"
    marks=""
    [[ "$dir" == "$cur" ]] && marks+=" [aktiv]"
    [[ "$dir" == "$prev" ]] && marks+=" [vorherige]"
    [[ -f "$dir/$BUILT_MARKER" ]] || marks+=" [unvollständig]"
    ver="$(pkg_version "$dir/package.json")"
    printf '  %-14s Version %-10s %s%s\n' "$name" "$ver" \
      "$(date -r "$dir" '+%d.%m.%Y %H:%M' 2>/dev/null || true)" "$marks"
  done < <(ls -1dt "$RELEASES_DIR"/*/ 2>/dev/null | sed 's#/$##')

  printf '\n%sNächster Auto-Update-Lauf:%s\n' "$C_BOLD" "$C_RESET"
  systemctl list-timers "$TIMER" --all --no-pager 2>/dev/null | sed 's/^/  /' || true
  printf '\n%sDienst:%s\n' "$C_BOLD" "$C_RESET"
  systemctl status "$SERVICE" --no-pager -n 0 2>/dev/null | sed 's/^/  /' || true
}

# ----------------------------------------------------------------------------
# Update per Knopfdruck aus der Admin-Oberfläche
# ----------------------------------------------------------------------------

# Verzeichnisse, .env-Einträge und den systemd-Wächter einrichten. Läuft bei
# jedem Update mit – so bekommen auch ältere Installationen die Funktion.
ensure_control_setup() {
  # Anfragen: root:vibeworks mit Sticky-Bit – die App darf Dateien anlegen,
  # aber keine fremden umbenennen oder löschen.
  install -d -o root -g "$APP_USER" -m 1770 "$CONTROL_DIR"
  # Status und Log: nur root schreibt, die App liest.
  install -d -o root -g root -m 0755 "$STATUS_DIR"
  if [[ -f "$ENV_FILE" ]] && ! grep -qE '^[[:space:]]*VIBEWORKS_CONTROL_DIR=' "$ENV_FILE"; then
    printf 'VIBEWORKS_CONTROL_DIR=%s\nVIBEWORKS_STATUS_DIR=%s\n' "$CONTROL_DIR" "$STATUS_DIR" >> "$ENV_FILE"
    info ".env ergänzt: VIBEWORKS_CONTROL_DIR, VIBEWORKS_STATUS_DIR"
  fi
  if [[ -f /etc/systemd/system/vibeworks-control.path ]] && ! systemctl is-enabled --quiet vibeworks-control.path 2>/dev/null; then
    systemctl daemon-reload
    systemctl enable --now vibeworks-control.path >/dev/null 2>&1 || warn "vibeworks-control.path konnte nicht aktiviert werden."
  fi
}

# Zeichenkette als JSON-String
json_str() {
  local s
  s="$(printf '%s' "$1" | tr -d '\000-\010\013\014\016-\037')"
  s="${s//\\/\\\\}"
  s="${s//\"/\\\"}"
  s="${s//$'\n'/\\n}"
  s="${s//$'\r'/}"
  s="${s//$'\t'/\\t}"
  printf '"%s"' "$s"
}

# {"sha":…,"version":…} eines Stands
version_json() {
  printf '{"sha":%s,"version":%s}' "$(json_str "$1")" "$(json_str "$(pkg_version_at "$1")")"
}

# write_status <aktion> <zustand> <meldung> <begonnen> [beendet] [weitere JSON-Felder]
# Atomar über eine temporäre Datei – die App liest nie einen halben Stand.
write_status() {
  local action="$1" state="$2" msg="$3" started="$4" finished="${5:-}" extra="${6:-}" fin tmp
  if [[ -n "$finished" ]]; then fin="$(json_str "$finished")"; else fin="null"; fi
  install -d -o root -g root -m 0755 "$STATUS_DIR"
  tmp="$(mktemp "$STATUS_DIR/.status.XXXXXX")"
  printf '{"action":%s,"state":%s,"message":%s,"startedAt":%s,"finishedAt":%s%s}\n' \
    "$(json_str "$action")" "$(json_str "$state")" "$(json_str "$msg")" "$(json_str "$started")" "$fin" "${extra:+,$extra}" > "$tmp"
  chmod 0644 "$tmp"
  mv -f "$tmp" "$STATUS_DIR/status.json"
}

app_check() {
  local started sha cur behind commits="" first=1 csha subj latest current msg
  started="$(date -Is)"
  write_status check running "Suche nach Updates …" "$started"
  if ! g fetch --prune --tags --force origin >/dev/null 2>&1; then
    write_status check failed "Das Repository ist gerade nicht erreichbar (Netzwerk/GitHub?)." "$started" "$(date -Is)"
    return 0
  fi
  if ! sha="$(resolve_ref "$(tracked_branch)")"; then
    write_status check failed "Der Branch $(tracked_branch) wurde nicht gefunden." "$started" "$(date -Is)"
    return 0
  fi
  cur="$(release_sha "$(link_target "$CURRENT_LINK")")"
  if [[ -n "$cur" ]]; then
    behind="$(g rev-list --count "$cur..$sha" 2>/dev/null || echo 0)"
    current="$(version_json "$cur")"
  else
    behind="$(g rev-list --count "$sha")"
    current="null"
  fi
  while IFS=$'\x1f' read -r csha subj; do
    [[ -n "$csha" ]] || continue
    if [[ $first -eq 0 ]]; then commits+=","; fi
    first=0
    commits+="{\"sha\":$(json_str "${csha:0:7}"),\"subject\":$(json_str "$subj")}"
  done < <(if [[ -n "$cur" ]]; then g log --format='%H%x1f%s' -n 20 "$cur..$sha"; else g log --format='%H%x1f%s' -n 20 "$sha"; fi 2>/dev/null)
  latest="{\"sha\":$(json_str "$sha"),\"version\":$(json_str "$(pkg_version_at "$sha")"),\"behind\":${behind:-0},\"commits\":[$commits]}"
  if [[ "$sha" == "$cur" ]]; then msg="VibeWorks ist aktuell."; else msg="Update verfügbar: Version $(pkg_version_at "$sha")"; fi
  write_status check "done" "$msg" "$started" "$(date -Is)" "\"current\":$current,\"latest\":$latest"
}

app_update() {
  local started log before after rc msg current
  started="$(date -Is)"
  log="$STATUS_DIR/update.log"
  install -d -o root -g root -m 0755 "$STATUS_DIR"
  : > "$log"
  chmod 0644 "$log"
  before="$(release_sha "$(link_target "$CURRENT_LINK")")"
  if [[ -n "$before" ]]; then current="$(version_json "$before")"; else current="null"; fi
  write_status update running "Update läuft – die Seite lädt nach dem Neustart von selbst neu." "$started" "" "\"current\":$current"
  # Als eigener Prozess: er darf sich selbst aktualisieren (exec) und startet
  # den App-Dienst neu, ohne dass dieser Status verloren geht. Die Sperre
  # (fd 9) erbt er.
  set +e
  VIBEWORKS_LOCK_HELD=1 "$INSTALLED_SELF" --yes >> "$log" 2>&1
  rc=$?
  set -e
  after="$(release_sha "$(link_target "$CURRENT_LINK")")"
  if [[ -n "$after" ]]; then current="$(version_json "$after")"; else current="null"; fi
  case "$rc" in
    0)
      if [[ "$after" == "$before" ]]; then msg="VibeWorks war bereits aktuell."; else msg="Update installiert – VibeWorks läuft jetzt mit Version $(pkg_version_at "$after")."; fi
      write_status update "done" "$msg" "$started" "$(date -Is)" "\"exitCode\":0,\"current\":$current"
      ;;
    *)
      case "$rc" in
        3) msg="Der Build ist fehlgeschlagen – die bisherige Version läuft unverändert weiter." ;;
        4) msg="Die Datenbank-Migration ist fehlgeschlagen – die bisherige Version läuft weiter." ;;
        5) msg="Die neue Version antwortete nicht – es wurde automatisch zurückgerollt." ;;
        *) msg="Das Update ist fehlgeschlagen (Code $rc)." ;;
      esac
      write_status update failed "$msg" "$started" "$(date -Is)" "\"exitCode\":$rc,\"current\":$current"
      ;;
  esac
}

do_from_app() {
  local req="$CONTROL_DIR/request" action=""
  # Die Anfrage schreibt der App-Benutzer – sie ist nicht vertrauenswürdig:
  # nur eine gewöhnliche Datei (kein Symlink, keine FIFO), nur zwei Wörter.
  if [[ -f "$req" && ! -L "$req" ]]; then
    action="$(head -c 16 -- "$req" 2>/dev/null | tr -cd 'a-z')"
  fi
  rm -f -- "$req"
  [[ "$action" == "check" || "$action" == "update" ]] || exit 0

  exec 9>"$LOCK_FILE"
  if ! flock -n 9; then
    write_status "$action" busy "Gerade läuft schon ein Update – bitte kurz warten." "$(date -Is)" "$(date -Is)"
    exit 0
  fi
  export VIBEWORKS_LOCK_HELD=1
  if [[ "$action" == "check" ]]; then app_check; else app_update; fi
}

# ----------------------------------------------------------------------------
# Adresse ändern
# ----------------------------------------------------------------------------
do_domain() {
  local value="${DOMAIN_ARG%/}" url
  if [[ "$value" =~ ^https?:// ]]; then url="$value"; else url="https://$value"; fi
  # Streng prüfen – der Wert landet per sed in der .env.
  [[ "$url" =~ ^https?://[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?(:[0-9]{1,5})?$ ]] \
    || die "Ungültige Adresse: $DOMAIN_ARG (Beispiele: vibeworks.example.de, http://192.168.1.50:3000)"
  [[ -f "$ENV_FILE" ]] || die "$ENV_FILE fehlt."

  local old
  old="$(env_get APP_URL)"
  if grep -qE '^[[:space:]]*APP_URL=' "$ENV_FILE"; then
    sed -i "s|^[[:space:]]*APP_URL=.*|APP_URL=${url}|" "$ENV_FILE"
  else
    printf 'APP_URL=%s\n' "$url" >> "$ENV_FILE"
  fi
  ok "Adresse: ${old:-–} -> $url"

  if service_exists; then
    restart_service
    if wait_for_health; then ok "VibeWorks läuft wieder."; else warn "VibeWorks antwortet nicht – Logs: journalctl -u vibeworks -n 100"; fi
  fi

  printf '\n%sBitte beachten:%s\n' "$C_BOLD" "$C_RESET"
  if [[ "$url" == https://* ]]; then
    printf '  • HTTPS kommt vom Reverse Proxy (z. B. Caddy, nginx, Nginx Proxy Manager) – er leitet auf Port %s dieses Containers weiter\n' "$(app_port)"
    printf '    und muss den Host-Header durchreichen (Caddy: automatisch, nginx: proxy_set_header Host $host;).\n'
  fi
  printf '  • Passkeys hängen an der Adresse – nach einem Wechsel unter „Mein Konto“ neu anlegen.\n'
  printf '  • Alle Benutzer werden einmal abgemeldet.\n'
}

# ----------------------------------------------------------------------------
# Hauptprogramm
# ----------------------------------------------------------------------------
case "$ACTION" in
  update|check|install)
    if [[ $MODE_AUTO -eq 1 && -f "$AUTO_DISABLED_FILE" ]]; then
      exit 0
    fi
    do_update
    ;;
  rollback) do_rollback ;;
  auto-on)  do_auto_on ;;
  auto-off) do_auto_off ;;
  status)   do_status ;;
  from-app) do_from_app ;;
  domain)   do_domain ;;
esac
