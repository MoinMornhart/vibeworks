import { describe, expect, it } from "vitest";
import { handleBody, RPC, type ServerOptions } from "./protocol";

type Ctx = { user: string };
const base: ServerOptions<Ctx> = {
  info: { name: "vibeworks", title: "VibeWorks", version: "0.0.0" },
  instructions: "Hallo",
  describeError: async (err) => (err instanceof Error ? `Fehler: ${err.message}` : "?"),
  tools: [],
};
const withExtras: ServerOptions<Ctx> = {
  ...base,
  prompts: {
    list: async (ctx) => [{ name: "review", title: `Review für ${ctx.user}`, arguments: [{ name: "project" }] }],
    get: async (name, args) => (name === "review" ? { description: "Review", text: `Prüfe ${args.project ?? "alles"}` } : null),
  },
  resources: {
    list: async () => [{ uri: "vibeworks://today", name: "today", mimeType: "text/markdown" }],
    read: async (uri) => {
      if (uri === "vibeworks://boom") throw new Error("kaputt");
      return uri === "vibeworks://today" ? { mimeType: "text/markdown", text: "# Heute" } : null;
    },
  },
};
const call = (opts: ServerOptions<Ctx>, msg: unknown) => handleBody(JSON.stringify(msg), { user: "morni" }, opts);

describe("MCP: Prompts und Ressourcen", () => {
  it("initialize meldet die Fähigkeiten nur, wenn es sie gibt", async () => {
    const plain = await call(base, { jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
    expect((plain.body as { result: { capabilities: object } }).result.capabilities).toEqual({ tools: { listChanged: false } });
    const full = await call(withExtras, { jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
    expect(full.body).toMatchObject({ result: { capabilities: { tools: {}, prompts: { listChanged: false }, resources: { subscribe: false } } } });
  });

  it("ohne Anbieter: Methode unbekannt", async () => {
    expect(await call(base, { jsonrpc: "2.0", id: 2, method: "prompts/list" })).toMatchObject({ body: { error: { code: RPC.METHOD_NOT_FOUND } } });
    expect(await call(base, { jsonrpc: "2.0", id: 3, method: "resources/read", params: { uri: "x" } })).toMatchObject({ body: { error: { code: RPC.METHOD_NOT_FOUND } } });
  });

  it("prompts/list und prompts/get mit Argumenten", async () => {
    expect(await call(withExtras, { jsonrpc: "2.0", id: 4, method: "prompts/list" })).toMatchObject({ body: { result: { prompts: [{ name: "review", title: "Review für morni" }] } } });
    const got = await call(withExtras, { jsonrpc: "2.0", id: 5, method: "prompts/get", params: { name: "review", arguments: { project: "Wetter-App", ignored: 5 } } });
    expect(got.body).toMatchObject({ result: { description: "Review", messages: [{ role: "user", content: { type: "text", text: "Prüfe Wetter-App" } }] } });
    expect(await call(withExtras, { jsonrpc: "2.0", id: 6, method: "prompts/get", params: { name: "gibts-nicht" } })).toMatchObject({ body: { error: { code: RPC.INVALID_PARAMS } } });
    expect(await call(withExtras, { jsonrpc: "2.0", id: 7, method: "prompts/get", params: {} })).toMatchObject({ body: { error: { code: RPC.INVALID_PARAMS } } });
  });

  it("resources: Liste, Lesen, unbekannt, Fehler", async () => {
    expect(await call(withExtras, { jsonrpc: "2.0", id: 8, method: "resources/list" })).toMatchObject({ body: { result: { resources: [{ uri: "vibeworks://today" }] } } });
    expect(await call(withExtras, { jsonrpc: "2.0", id: 9, method: "resources/templates/list" })).toMatchObject({ body: { result: { resourceTemplates: [] } } });
    expect(await call(withExtras, { jsonrpc: "2.0", id: 10, method: "resources/read", params: { uri: "vibeworks://today" } })).toMatchObject({
      body: { result: { contents: [{ uri: "vibeworks://today", mimeType: "text/markdown", text: "# Heute" }] } },
    });
    expect(await call(withExtras, { jsonrpc: "2.0", id: 11, method: "resources/read", params: { uri: "vibeworks://nix" } })).toMatchObject({ body: { error: { code: RPC.RESOURCE_NOT_FOUND } } });
    expect(await call(withExtras, { jsonrpc: "2.0", id: 12, method: "resources/read", params: { uri: "vibeworks://boom" } })).toMatchObject({
      body: { error: { code: RPC.INTERNAL, message: "Fehler: kaputt" } },
    });
  });
});
