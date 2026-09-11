import { describe, expect, it } from "vitest";
import { eventsOf, ntfyRequest, parseNtfyUrl, splitLastError, webhookBody, type Notice } from "./format";

const notice: Notice = { event: "ciFailed", title: "CI fehlgeschlagen: Übersicht", message: "build ist rot", url: "https://vibeworks.example.de/projects/1", priority: "high" };

describe("Anlässe", () => {
  it("fehlende Schalter sind an, ausdrücklich ausgeschaltete aus", () => {
    expect(eventsOf(null)).toEqual({ taskDue: true, accessRequest: true, issueClosed: true, ciFailed: true, siteDown: true, updated: true });
    expect(eventsOf({ ciFailed: false, taskDue: true }).ciFailed).toBe(false);
  });
});

describe("ntfy", () => {
  it("zerlegt Server und Thema", () => {
    expect(parseNtfyUrl("https://ntfy.sh/mein-thema")).toEqual({ server: "https://ntfy.sh", topic: "mein-thema" });
    expect(parseNtfyUrl("http://192.168.1.5:8080/haus_alarm/")).toEqual({ server: "http://192.168.1.5:8080", topic: "haus_alarm" });
    expect(parseNtfyUrl("https://ntfy.sh/")).toBeNull();
    expect(parseNtfyUrl("https://ntfy.sh/a/b")).toBeNull();
  });

  it("veröffentlicht per JSON mit Umlauten, Priorität, Link und Token", () => {
    const req = ntfyRequest("https://ntfy.sh/vw", notice, "tk_123")!;
    expect(req.url).toBe("https://ntfy.sh");
    expect(req.headers).toEqual({ Authorization: "Bearer tk_123" });
    expect(req.body).toMatchObject({ topic: "vw", title: "CI fehlgeschlagen: Übersicht", priority: 4, click: notice.url, tags: ["x"] });
  });
});

describe("Webhook", () => {
  it("Discord und Slack bekommen ihr Format", () => {
    expect(webhookBody("https://discord.com/api/webhooks/1/abc", notice)).toMatchObject({ username: "VibeWorks", content: expect.stringContaining("**CI fehlgeschlagen") });
    expect(webhookBody("https://hooks.slack.com/services/x", notice)).toEqual({ text: expect.stringContaining(`<${notice.url}>`) });
  });

  it("alle anderen ein JSON mit Anlass", () => {
    expect(webhookBody("https://ha.example.de/api/webhook/vw", notice)).toMatchObject({ app: "VibeWorks", event: "ciFailed", title: notice.title, url: notice.url });
  });
});

describe("letzter Fehler", () => {
  it("trennt Kanal und Meldung", () => {
    expect(splitLastError("email|notify.errors.noSmtp")).toEqual({ channel: "email", error: "notify.errors.noSmtp" });
    expect(splitLastError("alt ohne Kanal")).toEqual({ channel: null, error: "alt ohne Kanal" });
    expect(splitLastError(null)).toBeNull();
  });
});
