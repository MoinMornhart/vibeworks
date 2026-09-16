// Git-Zugänge regelmäßig prüfen (#98): Gilt der Token noch, und hat er die
// Rechte, die VibeWorks braucht? Reine Auswertung ohne Netz.

export type ScopeKind = "classic" | "fine-grained" | "gitlab" | "unknown";

/** Was VibeWorks braucht – und wofür die optionalen Rechte gut sind. */
export const REQUIRED_SCOPES: Record<"github" | "gitlab", string[]> = { github: ["repo"], gitlab: ["api"] };
export const OPTIONAL_SCOPES: Record<"github" | "gitlab", Array<{ scope: string; feature: "workflow" | "webhook" }>> = {
  github: [
    { scope: "workflow", feature: "workflow" },
    { scope: "admin:repo_hook", feature: "webhook" },
  ],
  gitlab: [],
};

export interface ScopeReport {
  kind: ScopeKind;
  missing: string[];
  optionalMissing: Array<{ scope: string; feature: "workflow" | "webhook" }>;
}

/** GitHub nennt die Rechte eines klassischen Tokens im Header „x-oauth-scopes“. */
export function parseScopesHeader(header: string | null): string[] | null {
  if (header === null) return null;
  return header
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const has = (scopes: string[], wanted: string) => scopes.includes(wanted) || (wanted === "admin:repo_hook" && scopes.includes("write:repo_hook"));

export function evaluateScopes(provider: string, token: string, scopes: string[] | null): ScopeReport {
  if (provider === "github") {
    // Feingranulare Tokens verraten ihre Rechte nicht – die zeigen sich beim Gebrauch
    if (scopes === null) return { kind: token.startsWith("github_pat_") ? "fine-grained" : "unknown", missing: [], optionalMissing: [] };
    return {
      kind: "classic",
      missing: REQUIRED_SCOPES.github.filter((s) => !has(scopes, s)),
      optionalMissing: OPTIONAL_SCOPES.github.filter((o) => !has(scopes, o.scope)),
    };
  }
  if (provider === "gitlab" && scopes !== null) {
    // read_api + read_repository reichen zum Lesen, „api“ braucht es für Issues
    return { kind: "gitlab", missing: REQUIRED_SCOPES.gitlab.filter((s) => !scopes.includes(s)), optionalMissing: [] };
  }
  return { kind: "unknown", missing: [], optionalMissing: [] };
}

/** Kennzeichen eines Problems – gemeldet wird nur, wenn es sich ändert. */
export function problemKey(error: string | null, report: ScopeReport | null): string | null {
  if (error) return `error:${error}`;
  if (report?.missing.length) return `missing:${report.missing.join(",")}`;
  return null;
}
