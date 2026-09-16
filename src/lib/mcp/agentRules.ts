// Regeln für KI-Agenten – bewusst auf Englisch, damit jedes Modell sie gleich
// versteht. Als Skill-Datei zum lokalen Speichern (Claude Code, Gemini,
// AGENTS.md). Die Werkzeugliste entsteht aus den echten Werkzeugen, damit die
// KI nur kennt, was es wirklich gibt.

export const RULES_TOOL = "get_agent_rules";
export const CONFIRM_TOOL = "confirm_agent_rules";

/** Hinweis in jeder Werkzeug-Antwort, bis die Regeln bestätigt sind. */
export const RULES_REMINDER = `VibeWorks: please call ${RULES_TOOL} once, save the rules locally as described there, then call ${CONFIRM_TOOL}. This reminder disappears afterwards.`;

const firstSentence = (s: string) => s.split(/(?<=[.!?])\s/)[0].trim();

export function agentRules(tools: Array<{ name: string; title: string; description: string }>, appUrl: string): string {
  const list = tools.map((t) => `- \`${t.name}\` – ${t.title}: ${firstSentence(t.description)}`).join("\n");
  return `---
name: vibeworks
description: Work with the user's VibeWorks project control center over MCP – projects, tasks, notes, docs, the error inbox and time tracking. Use it whenever the user mentions VibeWorks, their projects, tasks or errors.
---

# VibeWorks – rules for AI agents

VibeWorks (${appUrl}) is the user's self-hosted project control center. You reach it through the MCP server "vibeworks".

## Before anything else
1. Ask the user once which AI tool you are running in and where the rules should live – suggest the matching path below instead of guessing, and only write the file after the user agrees.
2. Save this file there so the rules survive new sessions:
   - Claude Code: \`~/.claude/skills/vibeworks/SKILL.md\`
   - Gemini CLI: append it to \`~/.gemini/GEMINI.md\`
   - Cline and other agents: \`AGENTS.md\` (or the tool's rules folder) in the project root
3. Call \`${CONFIRM_TOOL}\` with the path you used. Until then every tool result carries a reminder.

## Ground rules
- Only use the tools listed below. If something is not in the list, VibeWorks can't do it – say so instead of guessing or inventing a workaround.
- Never invent ids, names, numbers or results. Look them up first (list_projects, list_tasks, search).
- Read before you write: check the current state of a task or project before you change it.
- Refer to projects by id or exact name. If a name is ambiguous, ask the user.
- Every change appears in the activity log under the user's name – keep titles short and clear.
- Respect permissions: an error like "view only" or "owner only" means stop and tell the user – don't try another way around it.
- Starred projects are protected – only the user can change their status and repository in VibeWorks.
- Never put passwords, tokens or other secrets into tasks, notes, docs or descriptions.

## Working on a task
1. Find it with list_tasks or get_task. Pick the highest priority first (4 urgent, 3 high, 2 normal, 1 low); tasks labelled "notfix" are urgent bug fixes.
2. When you start: update_task with status DOING and assignee set to your name (e.g. "Claude"), so everyone sees who is on it. If the task has "instructions", the user wrote them for you – follow them.
3. Stuck: status BLOCKED with a short reason in the description.
4. Finished: status DONE. With issue sync the Git issue follows automatically; "Fixes #n" in a commit message closes it too.

## Problems and errors
- list_problems shows everything broken across projects; get_repo_status covers one project's repository, CI, dependencies and live site.
- list_errors shows runtime errors of the user's apps with stack traces – fix the cause, then call resolve_error.
- search_code and list_code_files look into the linked repository – use them instead of guessing file paths or function names.
- get_code_graph shows which files import a file, what it imports and the memos pinned to it – check it before changing a shared file, and pin what you learned with add_code_memo.

## Available tools (${tools.length})
${list}
`;
}
