import { describe, expect, it } from "vitest";
import { permissionStep } from "./codeDiagnose";

describe("Diagnose: Leserecht (#97)", () => {
  it("übersetzt Antworten des Anbieters in Schritte mit Lösung", () => {
    expect(permissionStep(200, { private: true, canPull: true, hasToken: true })).toMatchObject({ state: "ok", detail: "graph.diagnose.detail.privateOk" });
    expect(permissionStep(200, { private: false, canPull: null, hasToken: false })).toMatchObject({ state: "ok", detail: "graph.diagnose.detail.publicOk" });
    expect(permissionStep(200, { canPull: false, hasToken: true })).toMatchObject({ state: "error", fix: "account" });
    expect(permissionStep(401, { hasToken: true })).toMatchObject({ state: "error", detail: "graph.diagnose.detail.tokenInvalid", fix: "account" });
    expect(permissionStep(403, { hasToken: true })).toMatchObject({ state: "error", detail: "graph.diagnose.detail.forbidden" });
    expect(permissionStep(404, { hasToken: true })).toMatchObject({ state: "error", detail: "graph.diagnose.detail.noAccess", fix: "account" });
    expect(permissionStep(404, { hasToken: false })).toMatchObject({ state: "error", detail: "graph.diagnose.detail.privateNeedsToken", fix: "projectAccess" });
    expect(permissionStep(null, { hasToken: true })).toMatchObject({ state: "error", fix: "server" });
    expect(permissionStep(500, { hasToken: true }).detail).toBe("graph.diagnose.detail.providerError?status=500");
  });
});
