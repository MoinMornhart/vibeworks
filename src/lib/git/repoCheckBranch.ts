// Zweig für den Repo-Check (#125): Der Besitzer kann statt des Standardzweigs
// einen anderen wählen – leer/null heißt Standardzweig. Hier ohne Datenbank:
// Eingaben prüfen, Zweignamen säubern, gültig und erlaubt oder nicht.

const MAX_BRANCH = 200;

/**
 * Zweig normalisieren: Whitespace weg, null/leer wird null (Standardzweig).
 */
export function normalizeCheckBranch(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const branch = input.trim();
  if (!branch) return null;
  return branch.slice(0, MAX_BRANCH);
}

/** Regeln für Zweignamen, grob wie bei git check-ref-format – ohne volle Referenz-Spezifikation. */
export function checkBranchError(branch: string): string | null {
  if (!branch) return null; // null = Standardzweig
  if (branch.length > 200) return "check.errors.badBranch";
  if (branch.startsWith("/") || branch.endsWith("/")) return "check.errors.badBranch";
  if (branch.startsWith("-") || branch.includes("..")) return "check.errors.badBranch";
  if (branch.endsWith(".lock") || branch.includes("@{")) return "check.errors.badBranch";
  if (/[\s~^:?*[\\\u007f]/.test(branch)) return "check.errors.badBranch";
  return null;
}
