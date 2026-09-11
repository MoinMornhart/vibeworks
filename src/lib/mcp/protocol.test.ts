import { describe, expect, it } from "vitest";
import { handleBody, PROTOCOL_VERSIONS, RPC, type ServerOptions } from "./protocol";

const opts: ServerOptions<{ user: string }> = {
  info: { name: "vibeworks", title: "VibeWorks", version: "0.0.0" },
  instructions: "Hallo",
  describeError: async (err) => (err instanceof Error ? `Fehler: ${err.message}` : "?"),
  tools: [
    {
      name: "echo",
      title: "Echo",
      description: "Gibt zurück, was kommt",
      inputSchema: { type: "object", properties: { text: { type: "string" } } },
      run: async (args, ctx) => ({ text: args.text, user: ctx.user }),
    },
    {
      name: "boom",
      title: "Boom",
      description: "Scheitert",
      inputSchema: { type: "object", properties: {} },
      run: async () => {
        throw new Error("kaputt");
      },
    },
  ],
};
const ctx = { user: "morni" };
const call = (msg: unknown) => handleBody(JSON.stringify(msg), ctx, opts);

describe("MCP-Protokoll", () => {
  it("initialize handelt die Version aus", async () => {
    const known = await call({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26", capabilities: {} } });
    expect(known.status).toBe(200);
    expect(known.body).toMatchObject({ id: 1, result: { protocolVersion: "2025-03-26", capabilities: { tools: {} }, serverInfo: { name: "vibeworks" }, instructions: "Hallo" } });
    const unknown = await call({ jsonrpc: "2.0", id: 2, method: "initialize", params: { protocolVersion: "1999-01-01" } });
    expect(unknown.body).toMatchObject({ result: { protocolVersion: PROTOCOL_VERSIONS[0] } });
  });

  it("Benachrichtigungen bekommen 202 ohne Inhalt", async () => {
    expect(await call({ jsonrpc: "2.0", method: "notifications/initialized" })).toEqual({ status: 202, body: null });
  });

  it("listet Werkzeuge ohne die Funktion", async () => {
    const res = await call({ jsonrpc: "2.0", id: "a", method: "tools/list" });
    const tools = (res.body as { result: { tools: Array<Record<string, unknown>> } }).result.tools;
    expect(tools.map((t) => t.name)).toEqual(["echo", "boom"]);
    expect(tools[0].run).toBeUndefined();
  });

  it("ruft Werkzeuge mit Kontext auf", async () => {
    const res = await call({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "echo", arguments: { text: "hi" } } });
    const text = (res.body as { result: { content: Array<{ text: string }> } }).result.content[0].text;
    expect(JSON.parse(text)).toEqual({ text: "hi", user: "morni" });
  });

  it("Werkzeugfehler landen als isError im Ergebnis", async () => {
    const res = await call({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "boom" } });
    expect(res.body).toMatchObject({ result: { isError: true, content: [{ type: "text", text: "Fehler: kaputt" }] } });
  });

  it("unbekanntes Werkzeug und unbekannte Methode", async () => {
    expect(await call({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "nope" } })).toMatchObject({ body: { error: { code: RPC.INVALID_PARAMS } } });
    expect(await call({ jsonrpc: "2.0", id: 6, method: "resources/list" })).toMatchObject({ body: { error: { code: RPC.METHOD_NOT_FOUND } } });
  });

  it("kaputtes JSON, falsche Nachricht, Stapel", async () => {
    expect(await handleBody("{kaputt", ctx, opts)).toMatchObject({ status: 400, body: { error: { code: RPC.PARSE } } });
    expect(await call({ id: 1, method: "ping" })).toMatchObject({ body: { error: { code: RPC.INVALID_REQUEST } } });
    const batch = await call([{ jsonrpc: "2.0", id: 1, method: "ping" }, { jsonrpc: "2.0", method: "notifications/initialized" }]);
    expect(batch).toEqual({ status: 200, body: [{ jsonrpc: "2.0", id: 1, result: {} }] });
  });
});
