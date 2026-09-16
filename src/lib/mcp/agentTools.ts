import { z } from "zod";
import { db } from "@/lib/db";
import { config } from "@/lib/config";
import type { ToolDef } from "./protocol";
import { MCP_TOOLS, type McpContext } from "./tools";
import { agentRules, CONFIRM_TOOL, RULES_TOOL } from "./agentRules";

// Werkzeuge rund um die Agent-Regeln – getrennt von tools.ts, weil die Regeln
// die vollständige Werkzeugliste (samt dieser beiden) brauchen.

const ruleTools: ToolDef<McpContext>[] = [
  {
    name: RULES_TOOL,
    title: "Get agent rules",
    description:
      "The rules for working with VibeWorks as a skill file (Markdown with frontmatter). Call it once, save the file locally where it says, then call confirm_agent_rules.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
    run: async (_args, ctx) => agentRules(allMcpTools(), config.appUrl, ctx.locale),
  },
  {
    name: CONFIRM_TOOL,
    title: "Confirm agent rules",
    description: "Confirm that you saved the agent rules locally. Afterwards the reminder in tool results disappears for this API key.",
    inputSchema: {
      type: "object",
      properties: { saved_to: { type: "string", maxLength: 300, description: "Where you saved the rules, e.g. ~/.claude/skills/vibeworks/SKILL.md" } },
      required: ["saved_to"],
      additionalProperties: false,
    },
    annotations: { idempotentHint: true },
    run: async (args, ctx) => {
      const savedTo = z.string().trim().min(1).max(300).parse(args.saved_to);
      if (ctx.tokenId) await db.apiToken.update({ where: { id: ctx.tokenId }, data: { rulesAckAt: new Date() } });
      return { confirmed: true, savedTo };
    },
  },
];

let all: ToolDef<McpContext>[] | null = null;

/** Alle Werkzeuge des MCP-Servers. */
export function allMcpTools(): ToolDef<McpContext>[] {
  return (all ??= [...MCP_TOOLS, ...ruleTools]);
}
