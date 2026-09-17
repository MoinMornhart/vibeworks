// KI-Anleitungsdateien (#107): Nicht jede KI liest CLAUDE.md. Derselbe Inhalt
// geht als AGENTS.md, GEMINI.md, Copilot-, Cursor-, Windsurf- oder Cline-Regel
// hinaus – jeweils mit dem Kopf, den das Werkzeug erwartet. Ohne Datenbank.

export const AGENT_TARGETS = ["claude", "agents", "gemini", "copilot", "cursor", "windsurf", "cline"] as const;
export type AgentTarget = (typeof AGENT_TARGETS)[number];

export const AGENT_FILES: Record<AgentTarget, { path: string; tools: string }> = {
  claude: { path: "CLAUDE.md", tools: "Claude Code" },
  agents: { path: "AGENTS.md", tools: "Codex, Cline, Jules, OpenCode, Zed, Aider u. a." },
  gemini: { path: "GEMINI.md", tools: "Gemini CLI" },
  copilot: { path: ".github/copilot-instructions.md", tools: "GitHub Copilot" },
  cursor: { path: ".cursor/rules/vibeworks.mdc", tools: "Cursor" },
  windsurf: { path: ".windsurf/rules/vibeworks.md", tools: "Windsurf" },
  cline: { path: ".clinerules/vibeworks.md", tools: "Cline" },
};

export const isAgentTarget = (v: unknown): v is AgentTarget => typeof v === "string" && (AGENT_TARGETS as readonly string[]).includes(v);

/** Inhalt mit dem Kopf, den das Werkzeug erwartet. */
export function agentFile(target: AgentTarget, markdown: string, description: string): { path: string; content: string } {
  const body = markdown.trimEnd() + "\n";
  const oneLine = description.replace(/\s+/g, " ").replace(/"/g, "'").slice(0, 200);
  if (target === "cursor") return { path: AGENT_FILES.cursor.path, content: `---\ndescription: "${oneLine}"\nalwaysApply: true\n---\n\n${body}` };
  if (target === "windsurf") return { path: AGENT_FILES.windsurf.path, content: `---\ntrigger: always_on\ndescription: "${oneLine}"\n---\n\n${body}` };
  return { path: AGENT_FILES[target].path, content: body };
}

/** Dateien bzw. Ordner, an denen man eine KI-Anleitung im Repository erkennt. */
const AGENT_FILE_MATCHERS: RegExp[] = [
  /(^|\/)CLAUDE\.md$/i,
  /(^|\/)AGENTS\.md$/i,
  /(^|\/)GEMINI\.md$/i,
  /^\.github\/copilot-instructions\.md$/i,
  /^\.github\/instructions\/.+\.instructions\.md$/i,
  /^\.cursorrules$/,
  /^\.cursor\/rules\/.+\.mdc?$/,
  /^\.windsurfrules$/,
  /^\.windsurf\/rules\/.+\.md$/,
  /^\.clinerules(\/.+)?$/,
];

export const agentFilesIn = (files: string[]) => files.filter((f) => AGENT_FILE_MATCHERS.some((m) => m.test(f)));
