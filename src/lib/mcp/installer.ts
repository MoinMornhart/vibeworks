// MCP-Installer als Einzeiler (#89): richtet VibeWorks in Claude Code ein und
// legt die Agenten-Regeln als Skill ab – damit jede KI ohne Handarbeit loslegen
// kann. Die Skripte enthalten keine Daten, nur die Adresse dieser Instanz; der
// Schlüssel kommt aus VIBEWORKS_KEY und steht nie in einer URL.

const quoteSh = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;
const quotePs = (s: string) => `'${s.replace(/'/g, "''")}'`;

export const installCommands = (appUrl: string, key: string) => ({
  sh: `curl -fsSL ${appUrl}/api/mcp/install/sh | VIBEWORKS_KEY=${key} sh`,
  ps1: `$env:VIBEWORKS_KEY='${key}'; irm ${appUrl}/api/mcp/install/ps1 | iex`,
});

export function installSh(appUrl: string): string {
  return `#!/bin/sh
# VibeWorks – MCP einrichten (Claude Code) und Agenten-Regeln speichern
# Aufruf: curl -fsSL ${appUrl}/api/mcp/install/sh | VIBEWORKS_KEY=vw_… sh
set -eu
URL=${quoteSh(appUrl)}
KEY="\${VIBEWORKS_KEY:-\${1:-}}"
case "$KEY" in
  vw_*) ;;
  *) echo "VibeWorks: Bitte den Schlüssel angeben: … | VIBEWORKS_KEY=vw_… sh" >&2; exit 1 ;;
esac

echo "VibeWorks: prüfe den Schlüssel …"
RULES="$(curl -fsS -H "Authorization: Bearer $KEY" "$URL/api/mcp/rules")" || { echo "VibeWorks: Schlüssel ungültig oder Server nicht erreichbar." >&2; exit 1; }

if command -v claude >/dev/null 2>&1; then
  claude mcp remove --scope user vibeworks >/dev/null 2>&1 || true
  claude mcp add --scope user --transport http vibeworks "$URL/api/mcp" --header "Authorization: Bearer $KEY"
  echo "VibeWorks: in Claude Code eingetragen."
else
  echo "VibeWorks: Claude Code nicht gefunden – andere Clients: $URL/api/mcp (Streamable HTTP), Header Authorization: Bearer <Schlüssel>"
fi

DIR="$HOME/.claude/skills/vibeworks"
mkdir -p "$DIR"
printf '%s\\n' "$RULES" > "$DIR/SKILL.md"
echo "VibeWorks: Regeln gespeichert in $DIR/SKILL.md"
if command -v gemini >/dev/null 2>&1 || [ -d "$HOME/.gemini" ]; then
  mkdir -p "$HOME/.gemini"
  touch "$HOME/.gemini/GEMINI.md"
  grep -q "name: vibeworks" "$HOME/.gemini/GEMINI.md" || printf '\\n%s\\n' "$RULES" >> "$HOME/.gemini/GEMINI.md"
  echo "VibeWorks: Regeln auch für Gemini CLI hinterlegt."
fi
echo "Fertig. Frag deine KI zum Beispiel: „Welche Aufgaben sind in VibeWorks offen?“"
`;
}

/** Windows PowerShell 5.1 liest Skripte ohne BOM nicht als UTF-8 – deshalb nur ASCII. */
const ASCII: Record<string, string> = { ä: "ae", ö: "oe", ü: "ue", Ä: "Ae", Ö: "Oe", Ü: "Ue", ß: "ss", "–": "-", "…": "...", "„": "\"", "“": "\"", "”": "\"" };
const toAscii = (s: string) => s.replace(/[äöüÄÖÜß–…„“”]/g, (c) => ASCII[c]);

export function installPs1(appUrl: string): string {
  return toAscii(`# VibeWorks – MCP einrichten (Claude Code) und Agenten-Regeln speichern
# Aufruf: $env:VIBEWORKS_KEY='vw_…'; irm ${appUrl}/api/mcp/install/ps1 | iex
$ErrorActionPreference = 'Stop'
$Url = ${quotePs(appUrl)}
$Key = $env:VIBEWORKS_KEY
if (-not $Key -or -not $Key.StartsWith('vw_')) { Write-Error "VibeWorks: Bitte zuerst den Schlüssel setzen: \`$env:VIBEWORKS_KEY='vw_…'"; return }

Write-Host 'VibeWorks: prüfe den Schlüssel …'
try {
  $Rules = Invoke-RestMethod -Uri "$Url/api/mcp/rules" -Headers @{ Authorization = "Bearer $Key" }
} catch {
  Write-Error 'VibeWorks: Schlüssel ungültig oder Server nicht erreichbar.'; return
}

if (Get-Command claude -ErrorAction SilentlyContinue) {
  try { claude mcp remove --scope user vibeworks *> $null } catch {}
  claude mcp add --scope user --transport http vibeworks "$Url/api/mcp" --header "Authorization: Bearer $Key"
  Write-Host 'VibeWorks: in Claude Code eingetragen.'
} else {
  Write-Host "VibeWorks: Claude Code nicht gefunden – andere Clients: $Url/api/mcp (Streamable HTTP), Header Authorization: Bearer <Schlüssel>"
}

$Dir = Join-Path $HOME '.claude\\skills\\vibeworks'
New-Item -ItemType Directory -Force -Path $Dir | Out-Null
[System.IO.File]::WriteAllText((Join-Path $Dir 'SKILL.md'), $Rules, (New-Object System.Text.UTF8Encoding($false)))
Write-Host "VibeWorks: Regeln gespeichert in $Dir\\SKILL.md"
$Gemini = Join-Path $HOME '.gemini'
if ((Get-Command gemini -ErrorAction SilentlyContinue) -or (Test-Path $Gemini)) {
  New-Item -ItemType Directory -Force -Path $Gemini | Out-Null
  $File = Join-Path $Gemini 'GEMINI.md'
  if (-not (Test-Path $File) -or -not (Select-String -Path $File -Pattern 'name: vibeworks' -Quiet)) {
    [System.IO.File]::AppendAllText($File, [Environment]::NewLine + $Rules, (New-Object System.Text.UTF8Encoding($false)))
  }
  Write-Host 'VibeWorks: Regeln auch für Gemini CLI hinterlegt.'
}
Write-Host 'Fertig. Frag deine KI zum Beispiel: "Welche Aufgaben sind in VibeWorks offen?"'
`);
}
