import { describe, expect, it } from "vitest";
import { commitStatusState, githubRunState, gitlabPipelineState, latestPerName, overallState, type CiRun } from "./ci";

const run = (name: string, state: CiRun["state"], minutesAgo: number): CiRun => ({
  name,
  state,
  url: null,
  updatedAt: new Date(Date.UTC(2026, 8, 11, 12, 0) - minutesAgo * 60_000).toISOString(),
});

describe("CI-Zustände", () => {
  it("GitHub Actions", () => {
    expect(githubRunState("completed", "success")).toBe("success");
    expect(githubRunState("completed", "failure")).toBe("failure");
    expect(githubRunState("completed", "timed_out")).toBe("failure");
    expect(githubRunState("completed", "cancelled")).toBe("canceled");
    expect(githubRunState("in_progress", null)).toBe("running");
    expect(githubRunState("queued", null)).toBe("pending");
  });

  it("GitLab-Pipelines und Commit-Status", () => {
    expect(gitlabPipelineState("failed")).toBe("failure");
    expect(gitlabPipelineState("manual")).toBe("pending");
    expect(gitlabPipelineState("skipped")).toBe("canceled");
    expect(commitStatusState("error")).toBe("failure");
    expect(commitStatusState("warning")).toBe("success");
    expect(commitStatusState("pending")).toBe("pending");
  });

  it("Gesamtzustand: rot schlägt alles, dann läuft, wartet, grün", () => {
    expect(overallState([])).toBeNull();
    expect(overallState([run("a", "success", 1), run("b", "failure", 2)])).toBe("failure");
    expect(overallState([run("a", "success", 1), run("b", "running", 2)])).toBe("running");
    expect(overallState([run("a", "success", 1), run("b", "canceled", 2)])).toBe("success");
    expect(overallState([run("a", "canceled", 1)])).toBe("canceled");
  });

  it("je Workflow zählt nur der jüngste Lauf", () => {
    const latest = latestPerName([run("build", "failure", 30), run("build", "success", 5), run("lint", "success", 10)]);
    expect(latest.map((r) => `${r.name}:${r.state}`)).toEqual(["build:success", "lint:success"]);
    expect(overallState(latest)).toBe("success");
  });
});
