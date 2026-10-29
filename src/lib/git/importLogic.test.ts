import { describe, expect, it } from "vitest";
import { accentFor, listUrl, parseRepoList, renameCandidates, repoKey, reposToImport, statusFor, type RemoteRepo } from "./importLogic";

const repo = (url: string, extra: Partial<RemoteRepo> = {}): RemoteRepo => ({ url, name: url.split("/").pop()!, description: null, fork: false, archived: false, pushedAt: null, ...extra });

describe("repoKey", () => {
  it("vereinheitlicht Adressen", () => {
    expect(repoKey("https://github.com/Anna/App.git")).toBe("github.com/anna/app");
    expect(repoKey("https://github.com/anna/app/tree/main")).toBe("github.com/anna/app");
    expect(repoKey("http://192.168.1.5:3000/team/app")).toBe("192.168.1.5:3000/team/app");
    expect(repoKey(null)).toBeNull();
  });
});

describe("reposToImport", () => {
  it("überspringt Forks, archivierte, verknüpfte, entfernte und Doppelte", () => {
    const list = [
      repo("https://github.com/anna/neu"),
      repo("https://github.com/anna/fork", { fork: true }),
      repo("https://github.com/anna/alt", { archived: true }),
      repo("https://github.com/anna/Verknuepft"),
      repo("https://github.com/anna/geloescht"),
      repo("https://github.com/anna/neu"),
    ];
    const out = reposToImport(list, ["github.com/anna/verknuepft"], ["github.com/anna/geloescht"]);
    expect(out.map((r) => r.name)).toEqual(["neu"]);
  });
});

describe("statusFor", () => {
  const now = Date.parse("2026-09-14T12:00:00Z");
  it("kürzlich bearbeitet: In Entwicklung, sonst Offen", () => {
    expect(statusFor("2026-09-01T00:00:00Z", now)).toBe("IN_PROGRESS");
    expect(statusFor("2025-01-01T00:00:00Z", now)).toBe("OPEN");
    expect(statusFor(null, now)).toBe("OPEN");
  });
});

describe("accentFor", () => {
  it("immer dieselbe Farbe je Name", () => {
    expect(accentFor("vibeworks")).toBe(accentFor("vibeworks"));
  });
});

describe("listUrl", () => {
  it("GitHub, GitHub Enterprise, GitLab, Gitea", () => {
    expect(listUrl("github", "https://github.com", 2)).toBe("https://api.github.com/user/repos?affiliation=owner&sort=pushed&per_page=100&page=2");
    expect(listUrl("github", "https://git.firma.de", 1)).toContain("https://git.firma.de/api/v3/user/repos");
    expect(listUrl("gitlab", "https://gitlab.com", 1)).toContain("/api/v4/projects?owned=true&archived=false");
    expect(listUrl("gitea", "https://codeberg.org", 3)).toBe("https://codeberg.org/api/v1/user/repos?limit=50&page=3");
  });
});

describe("parseRepoList", () => {
  it("GitHub", () => {
    expect(parseRepoList("github", [{ html_url: "https://github.com/a/b", name: "b", description: "Text", fork: true, archived: false, pushed_at: "2026-09-01T00:00:00Z" }])).toEqual([
      { url: "https://github.com/a/b", name: "b", description: "Text", fork: true, archived: false, pushedAt: "2026-09-01T00:00:00Z" },
    ]);
  });
  it("GitLab: Fork über forked_from_project", () => {
    const [r] = parseRepoList("gitlab", [{ web_url: "https://gitlab.com/a/b", name: "B", description: "", forked_from_project: { id: 1 }, archived: false, last_activity_at: "x" }]);
    expect(r).toMatchObject({ url: "https://gitlab.com/a/b", name: "B", description: null, fork: true, pushedAt: "x" });
  });
  it("Gitea, Unbrauchbares fällt weg", () => {
    expect(parseRepoList("gitea", [{ html_url: "https://codeberg.org/a/b", name: "b", updated_at: "y" }, { name: "ohne-url" }, null, "x"])).toHaveLength(1);
    expect(parseRepoList("gitea", { message: "kaputt" })).toEqual([]);
  });
});

describe("renameCandidates", () => {
  const list = [repo("https://github.com/MoinMornhart/vibeworks"), repo("https://github.com/MoinMornhart/clipforge"), repo("https://github.com/MoinMornhart/alt", { archived: true })];

  it("findet Repositories, deren Besitzer sich geändert hat", () => {
    const out = renameCandidates(list, ["github.com/morni-team/vibeworks", "github.com/oldname/ClipForge"]);
    expect(out.map((c) => [c.oldKey, c.repo.url])).toEqual([
      ["github.com/morni-team/vibeworks", "https://github.com/MoinMornhart/vibeworks"],
      ["github.com/oldname/clipforge", "https://github.com/MoinMornhart/clipforge"],
    ]);
  });

  it("lässt Aktuelles, Fremdes, Archiviertes und Mehrdeutiges in Ruhe", () => {
    const twice = [...list, repo("https://github.com/zweiter/vibeworks")];
    expect(renameCandidates(list, ["github.com/moinmornhart/vibeworks"])).toEqual([]);
    expect(renameCandidates(list, ["gitlab.com/old/vibeworks", "github.com/old/sonstwas", "github.com/old/alt"])).toEqual([]);
    expect(renameCandidates(twice, ["github.com/old/vibeworks"])).toEqual([]);
  });
});
