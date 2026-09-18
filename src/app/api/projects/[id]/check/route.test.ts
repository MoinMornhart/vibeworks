import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Test der API-Route check/route.ts (#125): Der Besitzer setzt einen Zweig,
// er wird geprüft, gespeichert – und beim nächsten Lauf benutzt. Ohne echte
// Datenbank: db und Sitzung sind gemockt, das Anfrage-Objekt ist ein echtes NextRequest.

type FetchCall = { method: string; url: string; body?: unknown };

// vi.mock wird ans Dateianfang gezogen – der Zustand muss mit vi.hoisted davor
const { calls, projectRow, dbMock } = vi.hoisted(() => {
  const calls: FetchCall[] = [];
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
      findFirst: vi.fn(async () => ({ ...projectRow, members: [], teams: [] })),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        if ("checkBranch" in data) projectRow.checkBranch = data.checkBranch as string | null;
        return projectRow;
      }),
    },
    repoCache: {
      findUnique: vi.fn(async () => ({ provider: "github", defaultBranch: "main", checkStatus: null, checkError: null })),
      update: vi.fn(async () => ({})),
      updateMany: vi.fn(async () => ({})),
    },
    gitCredential: { findUnique: vi.fn(async () => null) },
    session: { findUnique: vi.fn(async () => null) },
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

// Sitzung des Besitzers – requireApiUser und getLocale lesen sie
vi.mock("@/lib/auth/session", () => ({
  readSessionToken: vi.fn(async () => "test-token"),
  validateSession: vi.fn(async () => ({
    sessionId: "s1",
    user: { id: "u1", username: "moini", displayName: "Moini", role: "USER", active: true, locale: "de" },
  })),
  createSession: vi.fn(),
  destroySession: vi.fn(),
  destroyAllSessions: vi.fn(),
}));

vi.mock("@/lib/crypto", () => ({
  encrypt: (s: string) => Buffer.from(s, "utf8").toString("base64"),
  decrypt: (c: string) => Buffer.from(c, "base64").toString("utf8"),
  randomToken: () => "t",
  sha256: (s: string) => `h-${s}`,
}));

// tokenCipherFor fragt das Projekt-Token ab – hier fest verdrahtet. Der
// Alias „@/lib/git/token" und der relative Import „./token" in githubActions.ts
// zeigen auf dieselbe Datei – ein Mock genügt.
vi.mock("@/lib/git/token", () => ({
  tokenCipherFor: vi.fn(async () => ({ cipher: Buffer.from("ghp_testtoken123", "utf8").toString("base64"), source: "project" })),
}));

import { POST } from "@/app/api/projects/[id]/check/route";
import { NextRequest, type NextRequest as NextRequestType } from "next/server";

function request(method: string, body: unknown): NextRequestType {
  return new NextRequest("http://localhost:3000/api/projects/p1/check", {
    method,
    headers: { "content-type": "application/json", origin: "http://localhost:3000", host: "localhost:3000" },
    body: JSON.stringify(body),
  });
}

const params = Promise.resolve({ id: "p1" });

beforeEach(() => {
  calls.length = 0;
  projectRow.checkBranch = null;
  dbMock.project.update.mockClear();
});

describe("Zweig-Auswahl über die API", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("setBranch speichert den Zweig und startRepoCheck nutzt ihn bei GitHub", async () => {
    const res = await POST(request("POST", { action: "setBranch", branch: "release/2.0" }), { params });
    expect(res.status).toBe(200);
    expect(dbMock.project.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ checkBranch: "release/2.0" }) }));
    const view = (await res.json()).check;
    expect(view.branch).toBe("release/2.0");
    expect(view.defaultBranch).toBe("main");
  });

  it("setBranch leert das Feld – null heißt wieder Standardzweig", async () => {
    projectRow.checkBranch = "feature/x";
    const res = await POST(request("POST", { action: "setBranch", branch: null }), { params });
    expect(res.status).toBe(200);
    expect(dbMock.project.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ checkBranch: null }) }));
    expect((await res.json()).check.branch).toBeNull();
  });

  it("setBranch lehnt kaputte Namen ab (400) – route() fängt den ApiError als Antwort", async () => {
    const res = await POST(request("POST", { action: "setBranch", branch: "a..b" }), { params });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("Zweigname");
    expect(dbMock.project.update).not.toHaveBeenCalled();
  });

  it("der Blick auf die Anfrage zeigt den Zweig in URL und Rumpf", async () => {
    projectRow.checkBranch = "release/2.0";
    const res = await POST(request("POST", { action: "run" }), { params });
    expect(res.status).toBe(200);
    // Einrichten: Datei im gewählten Zweig ansehen und anlegen (PUT mit branch)
    const read = calls.find((c) => c.method === "GET" && c.url.includes("/contents/.github/workflows/"));
    expect(read?.url).toBe("https://api.github.com/repos/team/repo/contents/.github/workflows/vibeworks-check.yml?ref=release%2F2.0");
    const put = calls.find((c) => c.method === "PUT" && c.url.includes("/contents/.github/workflows/"));
    expect(put?.url).toBe("https://api.github.com/repos/team/repo/contents/.github/workflows/vibeworks-check.yml");
    expect(put?.body).toMatchObject({ branch: "release/2.0" });
    const dispatch = calls.find((c) => c.method === "POST" && c.url.includes("/dispatches"));
    expect(dispatch?.body).toMatchObject({ ref: "release/2.0" });
    // Lauf-Abfrage nach demselben Zweig
    const runs = calls.find((c) => c.url.includes("/actions/workflows/vibeworks-check.yml/runs"));
    expect(runs?.url).toBe("https://api.github.com/repos/team/repo/actions/workflows/vibeworks-check.yml/runs?per_page=1&branch=release%2F2.0");
  });
});
