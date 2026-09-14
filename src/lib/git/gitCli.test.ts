import { describe, expect, it } from "vitest";
import { cloneUrl, explainGitError, gitEnv, parseGitLog, pickBranch } from "./gitCli";
import { parseRepoUrl } from "./parse";

describe("cloneUrl", () => {
  it("behält .git, schneidet Oberflächen-Pfade ab", () => {
    expect(cloneUrl("https://git.example.de/team/app.git", parseRepoUrl("https://git.example.de/team/app.git")!)).toBe("https://git.example.de/team/app.git");
    expect(cloneUrl("https://git.example.de/team/app/tree/main", parseRepoUrl("https://git.example.de/team/app/tree/main")!)).toBe("https://git.example.de/team/app");
  });
});

describe("gitEnv", () => {
  const headerOf = (env: Record<string, string>) => {
    const n = Object.entries(env).find(([k, v]) => k.startsWith("GIT_CONFIG_KEY_") && v === "http.extraHeader")?.[0].replace("KEY", "VALUE");
    return n ? env[n] : undefined;
  };
  it("sperrt Protokolle und Weiterleitungen, fragt nie nach", () => {
    const env = gitEnv(null);
    const pairs = Object.keys(env)
      .filter((k) => k.startsWith("GIT_CONFIG_KEY_"))
      .map((k) => [env[k], env[k.replace("KEY", "VALUE")]]);
    expect(pairs).toContainEqual(["protocol.allow", "never"]);
    expect(pairs).toContainEqual(["http.followRedirects", "false"]);
    expect(env.GIT_TERMINAL_PROMPT).toBe("0");
    expect(headerOf(env)).toBeUndefined();
    expect(Number(env.GIT_CONFIG_COUNT)).toBe(pairs.length);
  });
  it("Token als Basic-Auth – mit oder ohne Benutzer", () => {
    expect(headerOf(gitEnv("anna:geheim"))).toBe(`Authorization: Basic ${Buffer.from("anna:geheim").toString("base64")}`);
    expect(headerOf(gitEnv("tok123"))).toBe(`Authorization: Basic ${Buffer.from("oauth2:tok123").toString("base64")}`);
  });
});

describe("pickBranch", () => {
  const sha = "a".repeat(40);
  it("liest den Standardzweig aus der symref", () => {
    expect(pickBranch(`ref: refs/heads/trunk\tHEAD\n${sha}\tHEAD\n${sha}\trefs/heads/trunk\n`)).toBe("trunk");
  });
  it("ohne symref: main, master oder der erste", () => {
    expect(pickBranch(`${sha}\trefs/heads/dev\n${sha}\trefs/heads/master\n`)).toBe("master");
    expect(pickBranch(`${sha}\trefs/heads/dev\n`)).toBe("dev");
    expect(pickBranch("")).toBeNull();
  });
  it("verdächtige Namen fallen weg", () => {
    expect(pickBranch("ref: refs/heads/../../x\tHEAD\n")).toBeNull();
    expect(pickBranch("ref: refs/heads/-x\tHEAD\n")).toBeNull();
  });
});

describe("parseGitLog", () => {
  it("zerlegt Commits mit mehrzeiliger Nachricht", () => {
    const out = "abc\x1fAnna\x1f2026-09-14T10:00:00+02:00\x1fTitel\n\nMehr Text\n\x1e\ndef\x1fBob\x1f2026-09-13T09:00:00+02:00\x1fZweiter\n\x1e\n";
    expect(parseGitLog(out)).toEqual([
      { sha: "abc", title: "Titel", body: "Mehr Text", author: "Anna", date: "2026-09-14T10:00:00+02:00", url: null },
      { sha: "def", title: "Zweiter", body: "", author: "Bob", date: "2026-09-13T09:00:00+02:00", url: null },
    ]);
  });
});

describe("explainGitError", () => {
  const e = (stderr: string, extra: object = {}) => explainGitError(Object.assign(new Error("x"), { stderr, ...extra }));
  it("ordnet typische Meldungen zu", () => {
    expect(e("fatal: Authentication failed for 'https://x/'").status).toBe(401);
    expect(e("fatal: repository 'https://x/y/' not found").status).toBe(404);
    expect(e("fatal: unable to access 'https://x/': Could not resolve host: x").message).toContain("errors.unreachable");
    expect(e("fatal: unable to access: The requested URL returned error: 301").message).toContain("errors.gitRedirect");
    expect(e("", { code: "ENOENT" }).message).toContain("errors.gitMissing");
    expect(e("", { killed: true }).message).toContain("errors.timeout");
  });
});
