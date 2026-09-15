// Model Context Protocol über „Streamable HTTP“, zustandslos: jede Anfrage
// ist ein POST mit einer JSON-RPC-Nachricht (oder einem Stapel), die Antwort
// kommt als JSON. Ohne Datenbank und Netz – die Werkzeuge werden übergeben.

export const PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"] as const;

export const RPC = { PARSE: -32700, INVALID_REQUEST: -32600, METHOD_NOT_FOUND: -32601, INVALID_PARAMS: -32602, INTERNAL: -32603, RESOURCE_NOT_FOUND: -32002 } as const;

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

/** Vorlagen, die der Client als Befehle anbietet (in Claude Code: /mcp__server__name). */
export interface PromptInfo {
  name: string;
  title?: string;
  description?: string;
  arguments?: Array<{ name: string; description?: string; required?: boolean }>;
}
export interface PromptProvider<C> {
  list: (ctx: C) => Promise<PromptInfo[]>;
  /** null = unbekannt */
  get: (name: string, args: Record<string, string>, ctx: C) => Promise<{ description?: string; text: string } | null>;
}

/** Lesbare Inhalte, die der Client anhängen kann (in Claude Code: @server:uri). */
export interface ResourceInfo {
  uri: string;
  name: string;
  title?: string;
  description?: string;
  mimeType?: string;
}
export interface ResourceProvider<C> {
  list: (ctx: C) => Promise<ResourceInfo[]>;
  /** null = unbekannt */
  read: (uri: string, ctx: C) => Promise<{ mimeType: string; text: string } | null>;
}

export interface ServerOptions<C> {
  info: { name: string; title: string; version: string };
  instructions: string;
  tools: ToolDef<C>[];
  prompts?: PromptProvider<C>;
  resources?: ResourceProvider<C>;
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
  const methodNotFound = () => rpcError(id, RPC.METHOD_NOT_FOUND, `Method not found: ${String(msg.method)}`);
  // Fehler beim Lesen von Prompts/Ressourcen als JSON-RPC-Fehler mit lesbarer Meldung
  const safely = async (fn: () => Promise<RpcResponse>): Promise<RpcResponse> => {
    try {
      return await fn();
    } catch (err) {
      return rpcError(id, RPC.INTERNAL, await opts.describeError(err));
    }
  };

  switch (msg.method) {
    case "initialize": {
      const requested = params.protocolVersion;
      const version = (PROTOCOL_VERSIONS as readonly unknown[]).includes(requested) ? (requested as string) : PROTOCOL_VERSIONS[0];
      return ok(id, {
        protocolVersion: version,
        capabilities: {
          tools: { listChanged: false },
          ...(opts.prompts ? { prompts: { listChanged: false } } : {}),
          ...(opts.resources ? { resources: { listChanged: false, subscribe: false } } : {}),
        },
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
    case "prompts/list": {
      const prompts = opts.prompts;
      if (!prompts) return methodNotFound();
      return safely(async () => ok(id, { prompts: await prompts.list(ctx) }));
    }
    case "prompts/get": {
      const prompts = opts.prompts;
      if (!prompts) return methodNotFound();
      const name = params.name;
      if (typeof name !== "string") return rpcError(id, RPC.INVALID_PARAMS, "Missing prompt name");
      const args = isObject(params.arguments)
        ? (Object.fromEntries(Object.entries(params.arguments).filter(([, v]) => typeof v === "string")) as Record<string, string>)
        : {};
      return safely(async () => {
        const p = await prompts.get(name, args, ctx);
        if (!p) return rpcError(id, RPC.INVALID_PARAMS, `Unknown prompt: ${name}`);
        return ok(id, { ...(p.description ? { description: p.description } : {}), messages: [{ role: "user", content: { type: "text", text: p.text } }] });
      });
    }
    case "resources/list": {
      const resources = opts.resources;
      if (!resources) return methodNotFound();
      return safely(async () => ok(id, { resources: await resources.list(ctx) }));
    }
    case "resources/templates/list":
      if (!opts.resources) return methodNotFound();
      return ok(id, { resourceTemplates: [] });
    case "resources/read": {
      const resources = opts.resources;
      if (!resources) return methodNotFound();
      const uri = params.uri;
      if (typeof uri !== "string") return rpcError(id, RPC.INVALID_PARAMS, "Missing resource uri");
      return safely(async () => {
        const r = await resources.read(uri, ctx);
        if (!r) return rpcError(id, RPC.RESOURCE_NOT_FOUND, `Resource not found: ${uri}`);
        return ok(id, { contents: [{ uri, mimeType: r.mimeType, text: r.text }] });
      });
    }
    default:
      return methodNotFound();
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
