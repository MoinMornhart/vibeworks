import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { isPublicUrl, verifyWebhook } from "./webhook";

const SECRET = "geheimnis-123";
const BODY = JSON.stringify({ ref: "refs/heads/main" });
const hmac = createHmac("sha256", SECRET).update(BODY).digest("hex");

describe("Webhook-Signaturen", () => {
  it("GitHub: X-Hub-Signature-256", () => {
    expect(verifyWebhook(new Headers({ "x-github-event": "push", "x-hub-signature-256": `sha256=${hmac}` }), BODY, SECRET)).toEqual({ ok: true, event: "push" });
    expect(verifyWebhook(new Headers({ "x-github-event": "push", "x-hub-signature-256": `sha256=${"0".repeat(64)}` }), BODY, SECRET).ok).toBe(false);
  });

  it("Gitea/Forgejo: X-Gitea-Signature", () => {
    expect(verifyWebhook(new Headers({ "x-gitea-event": "issues", "x-gitea-signature": hmac }), BODY, SECRET)).toEqual({ ok: true, event: "issues" });
    expect(verifyWebhook(new Headers({ "x-forgejo-event": "push", "x-forgejo-signature": hmac }), BODY, SECRET).ok).toBe(true);
  });

  it("GitLab: X-Gitlab-Token", () => {
    expect(verifyWebhook(new Headers({ "x-gitlab-event": "Push Hook", "x-gitlab-token": SECRET }), BODY, SECRET)).toEqual({ ok: true, event: "push hook" });
    expect(verifyWebhook(new Headers({ "x-gitlab-token": "falsch" }), BODY, SECRET).ok).toBe(false);
  });

  it("ohne Signatur oder mit verändertem Inhalt abgelehnt", () => {
    expect(verifyWebhook(new Headers({ "x-github-event": "push" }), BODY, SECRET).ok).toBe(false);
    expect(verifyWebhook(new Headers({ "x-hub-signature-256": `sha256=${hmac}` }), `${BODY} `, SECRET).ok).toBe(false);
  });
});

describe("öffentliche Adresse", () => {
  it.each([
    ["https://vibeworks.morncloud.de", true],
    ["http://203.0.113.7:3000", true],
    ["http://localhost:3000", false],
    ["http://192.168.1.50:3000", false],
    ["http://10.0.0.5", false],
    ["http://172.20.1.1", false],
    ["http://vibeworks.lan", false],
    ["http://vibeworks", false],
  ])("%s → %s", (url, expected) => {
    expect(isPublicUrl(url)).toBe(expected);
  });
});
