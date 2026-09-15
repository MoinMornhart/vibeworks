import { describe, expect, it } from "vitest";
import { parseFork } from "./forkNotify";

describe("Fork aus dem Webhook", () => {
  it("GitHub", () => {
    const raw = JSON.stringify({ forkee: { full_name: "jonimoni09/vibeworks", html_url: "https://github.com/jonimoni09/vibeworks", private: false, owner: { login: "jonimoni09" } } });
    expect(parseFork(raw)).toEqual({ fullName: "jonimoni09/vibeworks", url: "https://github.com/jonimoni09/vibeworks", owner: "jonimoni09", private: false });
  });
  it("Gitea/Forgejo (username statt login)", () => {
    const raw = JSON.stringify({ forkee: { full_name: "peter/app", html_url: "https://git.example.de/peter/app", private: true, owner: { username: "peter" } } });
    expect(parseFork(raw)).toMatchObject({ owner: "peter", private: true });
  });
  it("Unsinn oder fremde Links: null", () => {
    expect(parseFork("kein json")).toBeNull();
    expect(parseFork(JSON.stringify({}))).toBeNull();
    expect(parseFork(JSON.stringify({ forkee: { full_name: "a/b", html_url: "javascript:alert(1)" } }))).toBeNull();
  });
});
