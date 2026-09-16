import { db } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { tk } from "@/lib/i18n/messages";
import { gitVersion, listFilesViaGit, listRemoteBranchesViaGit, localHeadViaGit } from "./gitCli";
import { guessProvider, parseRepoUrl } from "./parse";
import { apiBase, authHeaders, GitError, request } from "./providers";
import { tokenCipherFor } from "./token";

// Warum klappt Code-Netz bzw. Code-Suche nicht? (#97) Schritt für Schritt
// prüfen – jeder Schritt sagt, was los ist und wie man es behebt. Nur lesend.

export type DiagnoseState = "ok" | "warn" | "error" | "skip";
export type DiagnoseFix = "projectAccess" | "account" | "sync" | "fetch" | "server" | null;
export type DiagnoseKey = "repo" | "sync" | "token" | "git" | "permission" | "remote" | "copy";

export interface DiagnoseStep {
  key: DiagnoseKey;
  state: DiagnoseState;
  /** Übersetzungsschlüssel oder fertiger Text (Fehler des Anbieters) */
  detail: string | null;
  fix: DiagnoseFix;
}

const step = (key: DiagnoseKey, state: DiagnoseState, detail: string | null = null, fix: DiagnoseFix = null): DiagnoseStep => ({ key, state, detail, fix });

/** Rückmeldung des Anbieters auf „darf ich das Repository lesen?“ in einen Schritt übersetzen. */
export function permissionStep(status: number | null, info: { private?: boolean; canPull?: boolean | null; hasToken: boolean }): DiagnoseStep {
  if (status === null) return step("permission", "error", tk("graph", "diagnose.detail.unreachable"), "server");
  if (status === 401) return step("permission", "error", tk("graph", "diagnose.detail.tokenInvalid"), info.hasToken ? "account" : "projectAccess");
  if (status === 403) return step("permission", "error", tk("graph", "diagnose.detail.forbidden"), "account");
  if (status === 404) return step("permission", "error", tk("graph", info.hasToken ? "diagnose.detail.noAccess" : "diagnose.detail.privateNeedsToken"), info.hasToken ? "account" : "projectAccess");
  if (status >= 400) return step("permission", "error", tk("graph", "diagnose.detail.providerError", { status }), null);
  if (info.canPull === false) return step("permission", "error", tk("graph", "diagnose.detail.noPull"), "account");
  return step("permission", "ok", tk("graph", info.private ? "diagnose.detail.privateOk" : "diagnose.detail.publicOk"));
}

export async function diagnoseCodeCopy(projectId: string): Promise<DiagnoseStep[]> {
  const steps: DiagnoseStep[] = [];
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { id: true, ownerId: true, repoUrl: true, repoTokenCipher: true, repoCache: { select: { provider: true, defaultBranch: true, error: true } } },
  });
  const parsed = parseRepoUrl(project?.repoUrl ?? null);
  if (!project?.repoUrl || !parsed) {
    steps.push(step("repo", "error", tk("graph", "diagnose.detail.noRepo"), "projectAccess"));
    return steps;
  }
  steps.push(step("repo", "ok", `${parsed.host}/${parsed.path}`));

  const cache = project.repoCache;
  if (!cache) steps.push(step("sync", "error", tk("graph", "errors.notSynced"), "sync"));
  else if (cache.error) steps.push(step("sync", "error", cache.error, "sync"));
  else steps.push(step("sync", "ok", cache.defaultBranch ? tk("graph", "diagnose.detail.branch", { branch: cache.defaultBranch }) : null));

  // Zugang: Projekt-Token, sonst Konto-Token des Besitzers
  const stored = await tokenCipherFor(project);
  let token: string | null = null;
  if (stored) {
    try {
      token = decrypt(stored.cipher);
      steps.push(step("token", "ok", tk("graph", stored.source === "project" ? "diagnose.detail.projectToken" : "diagnose.detail.accountToken")));
    } catch {
      steps.push(step("token", "error", tk("git", "errors.decrypt"), "projectAccess"));
    }
  } else steps.push(step("token", "warn", tk("graph", "diagnose.detail.noToken"), "projectAccess"));

  const version = await gitVersion();
  steps.push(version ? step("git", "ok", `git ${version}`) : step("git", "error", tk("git", "errors.gitMissing"), "server"));

  const provider = cache?.provider || guessProvider(parsed.host) || "";
  if (provider === "github" || provider === "gitlab" || provider === "gitea") {
    try {
      const info = await request<{ private?: boolean; visibility?: string; permissions?: { pull?: boolean } | null }>("GET", apiBase(provider, parsed), authHeaders(provider, token));
      steps.push(
        permissionStep(200, {
          private: info.private ?? (info.visibility ? info.visibility !== "public" : undefined),
          canPull: info.permissions ? info.permissions.pull !== false : null,
          hasToken: Boolean(token),
        }),
      );
    } catch (err) {
      steps.push(permissionStep(err instanceof GitError && err.status ? err.status : null, { hasToken: Boolean(token) }));
    }
  } else steps.push(step("permission", "skip", tk("graph", "diagnose.detail.noApi")));

  if (!version) steps.push(step("remote", "skip"));
  else {
    try {
      const branches = await listRemoteBranchesViaGit(project.repoUrl, parsed, token);
      const want = cache?.defaultBranch;
      if (!branches.length) steps.push(step("remote", "error", tk("graph", "diagnose.detail.noBranches"), null));
      else if (want && !branches.includes(want)) steps.push(step("remote", "error", tk("graph", "diagnose.detail.branchMissing", { branch: want }), "sync"));
      else steps.push(step("remote", "ok", tk("graph", "diagnose.detail.branches", { n: branches.length })));
    } catch (err) {
      steps.push(step("remote", "error", err instanceof GitError ? err.message : tk("git", "errors.gitFailed"), token ? "account" : "projectAccess"));
    }
  }

  const branch = cache?.defaultBranch;
  const head = branch ? await localHeadViaGit(projectId, branch) : null;
  if (!head) steps.push(step("copy", "warn", tk("graph", "diagnose.detail.noCopy"), "fetch"));
  else {
    const files = await listFilesViaGit(projectId, branch!);
    steps.push(files.length ? step("copy", "ok", tk("graph", "diagnose.detail.copy", { n: files.length, commit: head.slice(0, 7) })) : step("copy", "error", tk("graph", "errors.noFiles"), "fetch"));
  }
  return steps;
}
