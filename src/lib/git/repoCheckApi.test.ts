import { beforeEach, describe, expect, it, vi } from "vitest";

// Der Test beweist (#125): Der gewählte Zweig landet wirklich in den
// GitHub-API-Aufrufen von githubTarget, latestWorkflowRun, dispatchWorkflow
// und beim Schreiben der Workflow-Datei – ohne Netz und ohne Datenbank.

type FetchCall = { method: string; url: string; body?: unknown };

// vi.mock wird ans Dateianfang gezogen – der Zustand muss mit vi.hoisted davor
const { calls, projectRow, dbMock } = vi.hoisted(() => {
  const calls: Array<{ method: string; url: string; body?: unknown }> = [];
  const projectRow = {
    id: "p1",
    name: "Projekt",
    ownerId: "u1",
    repoUrl: "https://github.com/team/repo",
    repoTokenCipher: null,
    repoCheck: true,
    checkBranch: null as string | null,
    checkTasks: "off",
  };
  const dbMock = {
    project: {
      // context() (repoCheck.ts) liest das Projekt samt verschachteltem RepoCache
      findUnique: vi.fn(async () => ({
        id: "p1",
        name: "Projekt",
        ownerId: "u1",
        repoUrl: "https://github.com/team/repo",
        repoTokenCipher: null,
        repoCheck: true,
        checkBranch: projectRow.checkBranch,
        checkTasks: "off",
        repoCache: { provider: "github", defaultBranch: "main", checkStatus: null, checkReport: null, checkRunUrl: null, checkFetchedAt: null, checkInstalledAt: null },
      })),
    },
    repoCache: {
      findUnique: vi.fn(async () => ({ provider: "github", defaultBranch: "main", checkStatus: null, checkError: null })),
      update: vi.fn(async () => ({})),
      updateMany: vi.fn(async () => ({})),
    },
    gitCredential: { findUnique: vi.fn(async () => null) },
  };
  return { calls, projectRow, dbMock };
});

vi.mock("@/lib/security/ssrf", () => ({
  // safeFetch wird gefangen und notiert, was VibeWorks wirklich an GitHub schicken würde.
  // Die Workflow-Datei ist noch nicht da (GET → 404), das Anlegen (PUT) klappt.
  safeFetch: vi.fn(async (url: string | URL, init?: { method?: string; body?: string }) => {
    const method = init?.method ?? "GET";
    calls.push({ method, url: String(url), body: init?.body ? JSON.parse(init.body) : undefined });
    if (method === "GET" && String(url).includes("/contents/")) return new Response("Not Found", { status: 404 });
    return new Response(JSON.stringify({ sha: "abc123", content: Buffer.from("alt").toString("base64") }), { status: 200 });
  }),
  FetchBlockedError: class FetchBlockedError extends Error {},
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));

import { dispatchWorkflow, githubTarget, latestWorkflowRun, writeRepoFile } from "./githubActions";
import { startRepoCheck } from "./repoCheck";

// tokenCipherFor fragt das Projekt-Token ab – hier fest verdrahtet
vi.mock("./token", () => ({
  tokenCipherFor: vi.fn(async () => ({ cipher: Buffer.from("ghp_testtoken123", "utf8").toString("base64"), source: "project" })),
}));

vi.mock("@/lib/crypto", () => ({
  encrypt: (s: string) => Buffer.from(s, "utf8").toString("base64"),
  decrypt: (c: string) => Buffer.from(c, "base64").toString("utf8"),
}));

beforeEach(() => {
  calls.length = 0;
  projectRow.checkBranch = null;
});

describe("checkBranch in den GitHub-Aufrufen", () => {
  it("ohne checkBranch gilt der Standardzweig aus dem Cache", async () => {
    const t = await githubTarget(projectRow);
    expect(t?.branch).toBe("main");
  });

  it("mit checkBranch wird er als ref für Datei, Lauf und Start verwendet", async () => {
    const t = await githubTarget(projectRow, "feature/next");
    expect(t?.branch).toBe("feature/next");
    if (!t) return;

    await writeRepoFile(t, ".github/workflows/vibeworks-check.yml", "x", "Nachricht", "sha-alt");
    const write = calls.find((c) => c.method === "PUT" && c.url.includes("/contents/.github/workflows/"));
    expect(write?.url).toBe("https://api.github.com/repos/team/repo/contents/.github/workflows/vibeworks-check.yml");
    expect(write?.body).toMatchObject({ branch: "feature/next" });

    calls.length = 0;
    await dispatchWorkflow(t, "vibeworks-check.yml");
    const dispatch = calls.find((c) => c.method === "POST" && c.url.includes("/dispatches"));
    expect(dispatch?.body).toMatchObject({ ref: "feature/next" });

    calls.length = 0;
    await latestWorkflowRun(t, "vibeworks-check.yml");
    const runs = calls.find((c) => c.url.includes("/actions/workflows/"));
    expect(runs?.url).toContain("branch=feature%2Fnext");
  });

  it("startRepoCheck reicht den Zweig aus dem Projekt durch – bis in Dispatch und Einrichtung", async () => {
    projectRow.checkBranch = "release/2.0";
    await startRepoCheck("p1");
    const dispatch = calls.find((c) => c.method === "POST" && c.url.includes("/dispatches"));
    expect(dispatch?.body).toMatchObject({ ref: "release/2.0" });
    // Einrichtung schreibt die Workflow-Datei in denselben Zweig
    const put = calls.find((c) => c.method === "PUT" && c.url.includes("/contents/.github/workflows/"));
    expect(put?.body).toMatchObject({ branch: "release/2.0" });
    // Und die Lauf-Abfrage fragt denselben Zweig ab
    const runs = calls.find((c) => c.url.includes("/actions/workflows/vibeworks-check.yml/runs"));
    expect(runs?.url).toContain("branch=release%2F2.0");
  });
});
