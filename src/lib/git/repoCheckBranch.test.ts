import { describe, expect, it } from "vitest";
import { checkBranchError, normalizeCheckBranch } from "./repoCheckBranch";

describe("Zweig-Auswahl für den Repo-Check", () => {
  it("leer und null bedeuten Standardzweig", () => {
    expect(normalizeCheckBranch(null)).toBeNull();
    expect(normalizeCheckBranch(undefined)).toBeNull();
    expect(normalizeCheckBranch("")).toBeNull();
    expect(normalizeCheckBranch("   ")).toBeNull();
    expect(normalizeCheckBranch("develop")).toBe("develop");
    expect(normalizeCheckBranch("  feature/x-2  ")).toBe("feature/x-2");
  });

  it("verwirft unsichere oder kaputte Namen", () => {
    for (const bad of ["-x", "a..b", "pfad/", "/pfad", "mit leer", "a~b", "a^b", "a:b", "a?b", "a*b", "a[b", "a\\b", "ende.lock", "a@{b"]) {
      expect(checkBranchError(bad), bad).toBe("check.errors.badBranch");
    }
    expect(checkBranchError("feature/ok-2.3_alpha")).toBeNull();
    expect(checkBranchError("v1.2.3")).toBeNull();
  });

  it("200-Zeichen-Namen sind erlaubt, längere nicht", () => {
    expect(checkBranchError("a".repeat(200))).toBeNull();
    expect(checkBranchError("a".repeat(201))).toBe("check.errors.badBranch");
  });
});
