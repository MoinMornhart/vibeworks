import { describe, expect, it } from "vitest";
import { handleMessage, type ClientInfo, type ServerOptions, type ToolCallInfo } from "./protocol";

type Ctx = { user: string };
const ctx: Ctx = { user: "u1" };

function server(extra: Partial<ServerOptions<Ctx>> = {}) {
  const calls: ToolCallInfo[] = [];
  const clients: ClientInfo[] = [];
  const opts: ServerOptions<Ctx> = {
    info: { name: "vibeworks", title: "VibeWorks", version: "1" },
    instructions: "Hallo",
    tools: [
      { name: "echo", title: "Echo", description: "Echo.", inputSchema: { type: "object", properties: {} }, run: async (a) => ({ got: a }) },
      { name: "boom", title: "Boom", description: "Fails.", inputSchema: { type: "object", properties: {} }, run: async () => { throw new Error("kaputt"); } },
    ],
    describeError: async (err) => (err instanceof Error ? err.message : "?"),
    onToolCall: (c) => void calls.push(c),
    onInitialize: (c) => void clients.push(c),
    outdatedNote: (v) => `Please update (${v}).`,
    ...extra,
  };
  return { opts, calls, clients };
}

const call = (opts: ServerOptions<Ctx>, name: string) => handleMessage({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: { a: 1 } } }, ctx, opts);
const init = (opts: ServerOptions<Ctx>, protocolVersion: string) =>
  handleMessage({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion, clientInfo: { name: "claude-code", version: "2.1.0" } } }, ctx, opts);

describe("MCP-Haken", () => {
  it("merkt sich Client und Protokollversion", async () => {
    const { opts, clients } = server();
    const res = await init(opts, "2025-06-18");
    expect(clients).toEqual([{ name: "claude-code", version: "2.1.0", protocol: "2025-06-18", supported: true }]);
    expect(res).toMatchObject({ result: { instructions: "Hallo" } });
  });

  it("veralteter Client: funktioniert, bekommt aber einen Hinweis", async () => {
    const { opts, clients } = server();
    const res = (await init(opts, "2024-10-07")) as { result: { protocolVersion: string; instructions: string } };
    expect(res.result.protocolVersion).toBe("2025-06-18");
    expect(res.result.instructions).toBe("Hallo Please update (2024-10-07).");
    expect(clients[0].supported).toBe(false);
    // Neuere, uns unbekannte Version: kein Hinweis
    const newer = (await init(opts, "2099-01-01")) as { result: { instructions: string } };
    expect(newer.result.instructions).toBe("Hallo");
  });

  it("protokolliert Aufrufe mit Erfolg, Fehler und unbekanntem Werkzeug", async () => {
    const { opts, calls } = server();
    await call(opts, "echo");
    await call(opts, "boom");
    await call(opts, "gibtsnicht");
    expect(calls.map((c) => [c.tool, c.ok, c.error])).toEqual([
      ["echo", true, null],
      ["boom", false, "kaputt"],
      ["gibtsnicht", false, "Unknown tool"],
    ]);
  });

  it("hängt einen Hinweis als zweiten Inhalt an – nur wenn es einen gibt", async () => {
    const withNote = server({ notice: (tool) => (tool === "echo" ? "Bitte Regeln holen." : null) });
    const res = (await call(withNote.opts, "echo")) as { result: { content: Array<{ text: string }> } };
    expect(res.result.content).toHaveLength(2);
    expect(res.result.content[1].text).toBe("Bitte Regeln holen.");
    const plain = (await call(server().opts, "echo")) as { result: { content: unknown[] } };
    expect(plain.result.content).toHaveLength(1);
  });

  it("ein kaputter Haken verdirbt die Antwort nicht", async () => {
    const { opts } = server({
      onToolCall: () => {
        throw new Error("DB weg");
      },
      notice: () => {
        throw new Error("auch weg");
      },
    });
    const res = (await call(opts, "echo")) as { result: { content: Array<{ text: string }>; isError?: boolean } };
    expect(res.result.isError).toBeUndefined();
    expect(res.result.content).toHaveLength(1);
  });
});
