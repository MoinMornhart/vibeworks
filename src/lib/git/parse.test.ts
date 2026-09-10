import { describe, expect, it } from "vitest";
import { guessProvider, newTokenUrl, normalizeServer, parseRepoUrl, splitCommitMessage, tokenHint } from "./parse";

describe("parseRepoUrl", () => {
  it.each([
    ["https://github.com/MoinMornhart/vibeworks", "github.com", "MoinMornhart/vibeworks"],
    ["https://github.com/MoinMornhart/vibeworks.git", "github.com", "MoinMornhart/vibeworks"],
    ["https://github.com/MoinMornhart/vibeworks/tree/main/src", "github.com", "MoinMornhart/vibeworks"],
    ["git@github.com:MoinMornhart/vibeworks.git", "github.com", "MoinMornhart/vibeworks"],
    ["https://gitlab.com/gruppe/sub/projekt/-/tree/main", "gitlab.com", "gruppe/sub/projekt"],
    ["https://git.wilde-server.de/florian.wilde/nebula", "git.wilde-server.de", "florian.wilde/nebula"],
    ["https://git.example.de/team/app/src/branch/main", "git.example.de", "team/app"],
    ["ssh://git@git.example.de/team/app.git", "git.example.de", "team/app"],
  ])("%s", (input, host, path) => {
    expect(parseRepoUrl(input)).toMatchObject({ host, path });
  });

  it("lehnt Unbrauchbares ab", () => {
    expect(parseRepoUrl("javascript:alert(1)")).toBeNull();
    expect(parseRepoUrl("https://github.com/nur-owner")).toBeNull();
    expect(parseRepoUrl("")).toBeNull();
  });
});

describe("Serveradressen", () => {
  it("merkt sich den Port für den Abgleich", () => {
    expect(parseRepoUrl("http://localhost:3999/team/app")).toMatchObject({ host: "localhost", hostPort: "localhost:3999" });
    expect(parseRepoUrl("https://github.com/a/b")).toMatchObject({ hostPort: "github.com" });
  });

  it("normalisiert Eingaben", () => {
    expect(normalizeServer("git.example.de")).toEqual({ baseUrl: "https://git.example.de", hostPort: "git.example.de" });
    expect(normalizeServer("http://192.168.1.5:3000/explore")).toEqual({ baseUrl: "http://192.168.1.5:3000", hostPort: "192.168.1.5:3000" });
    expect(normalizeServer("GitLab.com")).toEqual({ baseUrl: "https://gitlab.com", hostPort: "gitlab.com" });
    expect(normalizeServer("")).toBeNull();
    expect(normalizeServer("https://user:pw@git.example.de")).toBeNull();
    expect(normalizeServer("keinserver")).toBeNull();
  });

  it("baut die Token-Seite je Anbieter", () => {
    expect(newTokenUrl("github", "https://github.com")).toContain("scopes=repo");
    expect(newTokenUrl("gitlab", "https://gitlab.com")).toBe("https://gitlab.com/-/user_settings/personal_access_tokens?name=VibeWorks&scopes=api");
    expect(newTokenUrl("gitea", "https://git.example.de")).toBe("https://git.example.de/user/settings/applications");
  });
});

describe("Hilfen", () => {
  it("errät den Anbieter am Host", () => {
    expect(guessProvider("github.com")).toBe("github");
    expect(guessProvider("gitlab.firma.de")).toBe("gitlab");
    expect(guessProvider("codeberg.org")).toBe("gitea");
    expect(guessProvider("git.wilde-server.de")).toBeNull();
  });

  it("trennt Commit-Titel und Text", () => {
    expect(splitCommitMessage("Titel\n\nLanger Text\nZeile 2")).toEqual({ title: "Titel", body: "Langer Text\nZeile 2" });
    expect(splitCommitMessage("")).toEqual({ title: "(ohne Nachricht)", body: "" });
  });

  it("zeigt Tokens nur gekürzt", () => {
    expect(tokenHint("ghp_1234567890abcdef9f3a")).toBe("ghp_…9f3a");
    expect(tokenHint("kurz")).toBe("••••");
  });
});
