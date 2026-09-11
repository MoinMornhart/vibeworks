// Model Context Protocol über „Streamable HTTP“, zustandslos: jede Anfrage
// ist ein POST mit einer JSON-RPC-Nachricht (oder einem Stapel), die Antwort
// kommt als JSON. Ohne Datenbank und Netz – die Werkzeuge werden übergeben.

export const PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"] as const;

export const RPC = { PARSE: -32700, INVALID_REQUEST: -32600, METHOD_NOT_FOUND: -32601, INVALID_PARAMS: -32602, INTERNAL: -32603 } as const;

type Id = string | number;

export type RpcResponse =
  | { jsonrpc: "2.0"; id: Id | null; result: unknown }
  | { jsonrpc: "2.0"; id: Id | null; error: { code: number; message: string } };

export interface ToolDef<C> {
  name: string;
  title: string;
  description: string;
  inputSchema: { type: "object"; properties: Record<string, unknown>; required?: string[]; additionalProperties?: boolean };
  annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean; openWorldHint?: boolean };
  run: (args: Record<string, unknown>, ctx: C) => Promise<unknown>;
}

export interface ServerOptions<C> {
  info: { name: string; title: string; version: string };
  instructions: string;
  tools: ToolDef<C>[];
  /** Fehler eines Werkzeugs als Text für das Modell. */
  describeError: (err: unknown) => Promise<string>;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const ok = (id: Id, result: unknown): RpcResponse => ({ jsonrpc: "2.0", id, result });
export const rpcError = (id: Id | null, code: number, message: string): RpcResponse => ({ jsonrpc: "2.0", id, error: { code, message } });

/** Eine Nachricht verarbeiten – null bei Benachrichtigungen und Antworten (dafür gibt es keine Antwort). */
export async function handleMessage<C>(msg: unknown, ctx: C, opts: ServerOptions<C>): Promise<RpcResponse | null> {
  if (!isObject(msg) || msg.jsonrpc !== "2.0") return rpcError(null, RPC.INVALID_REQUEST, "Invalid request");
  if (typeof msg.method !== "string") return null; // Antwort des Clients
  if (!("id" in msg)) return null; // Benachrichtigung, z. B. notifications/initialized
  const id = msg.id;
  if (typeof id !== "string" && typeof id !== "number") return rpcError(null, RPC.INVALID_REQUEST, "Invalid request id");
  const params = isObject(msg.params) ? msg.params : {};

  switch (msg.method) {
    case "initialize": {
      const requested = params.protocolVersion;
      const version = (PROTOCOL_VERSIONS as readonly unknown[]).includes(requested) ? (requested as string) : PROTOCOL_VERSIONS[0];
      return ok(id, {
        protocolVersion: version,
        capabilities: { tools: { listChanged: false } },
        serverInfo: opts.info,
        instructions: opts.instructions,
      });
    }
    case "ping":
      return ok(id, {});
    case "tools/list":
      return ok(id, {
        tools: opts.tools.map(({ name, title, description, inputSchema, annotations }) => ({ name, title, description, inputSchema, annotations })),
      });
    case "tools/call": {
      const tool = opts.tools.find((t) => t.name === params.name);
      if (!tool) return rpcError(id, RPC.INVALID_PARAMS, `Unknown tool: ${String(params.name)}`);
      const args = isObject(params.arguments) ? params.arguments : {};
      try {
        const out = await tool.run(args, ctx);
        return ok(id, { content: [{ type: "text", text: typeof out === "string" ? out : JSON.stringify(out, null, 2) }] });
      } catch (err) {
        // Werkzeugfehler gehören ins Ergebnis, damit das Modell sie sieht und reagieren kann
        return ok(id, { content: [{ type: "text", text: await opts.describeError(err) }], isError: true });
      }
    }
    default:
      return rpcError(id, RPC.METHOD_NOT_FOUND, `Method not found: ${msg.method}`);
  }
}

/** Den Rumpf eines POST verarbeiten: 200 mit Antwort(en) oder 202 ohne Inhalt. */
export async function handleBody<C>(raw: string, ctx: C, opts: ServerOptions<C>): Promise<{ status: number; body: unknown }> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { status: 400, body: rpcError(null, RPC.PARSE, "Parse error") };
  }
  if (Array.isArray(parsed)) {
    if (!parsed.length || parsed.length > 50) return { status: 400, body: rpcError(null, RPC.INVALID_REQUEST, "Invalid batch") };
    const responses: RpcResponse[] = [];
    for (const m of parsed) {
      const r = await handleMessage(m, ctx, opts);
      if (r) responses.push(r);
    }
    return responses.length ? { status: 200, body: responses } : { status: 202, body: null };
  }
  const r = await handleMessage(parsed, ctx, opts);
  return r ? { status: 200, body: r } : { status: 202, body: null };
}
