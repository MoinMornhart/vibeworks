import { describe, expect, it } from "vitest";
import { evaluateScopes, parseScopesHeader, problemKey } from "./tokenCheckLogic";

describe("Token-Rechte (#98)", () => {
  it("liest den GitHub-Header", () => {
    expect(parseScopesHeader("repo, workflow ,admin:repo_hook")).toEqual(["repo", "workflow", "admin:repo_hook"]);
    expect(parseScopesHeader("")).toEqual([]);
    expect(parseScopesHeader(null)).toBeNull();
  });
  it("bewertet klassische GitHub-Tokens", () => {
    expect(evaluateScopes("github", "ghp_x", ["repo", "workflow", "admin:repo_hook"])).toEqual({ kind: "classic", missing: [], optionalMissing: [] });
    const r = evaluateScopes("github", "ghp_x", ["public_repo"]);
    expect(r.missing).toEqual(["repo"]);
    expect(r.optionalMissing.map((o) => o.feature)).toEqual(["workflow", "webhook"]);
    expect(evaluateScopes("github", "ghp_x", ["repo", "write:repo_hook"]).optionalMissing.map((o) => o.scope)).toEqual(["workflow"]);
  });
  it("feingranulare und andere Tokens: keine Vermutungen", () => {
    expect(evaluateScopes("github", "github_pat_x", null)).toEqual({ kind: "fine-grained", missing: [], optionalMissing: [] });
    expect(evaluateScopes("gitlab", "glpat", ["read_api"])).toMatchObject({ kind: "gitlab", missing: ["api"] });
    expect(evaluateScopes("gitea", "x", null).kind).toBe("unknown");
  });
  it("meldet nur echte Probleme", () => {
    expect(problemKey("git.errors.unauthorized", null)).toBe("error:git.errors.unauthorized");
    expect(problemKey(null, { kind: "classic", missing: ["repo"], optionalMissing: [] })).toBe("missing:repo");
    expect(problemKey(null, { kind: "classic", missing: [], optionalMissing: [{ scope: "workflow", feature: "workflow" }] })).toBeNull();
  });
});
