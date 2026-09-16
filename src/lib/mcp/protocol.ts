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

export interface ClientInfo {
  name: string | null;
  version: string | null;
  /** Vom Client verlangte Protokollversion */
  protocol: string | null;
  /** Kennen wir diese Version? */
  supported: boolean;
}

export interface ToolCallInfo {
  tool: string;
  ok: boolean;
  ms: number;
  /** Fehlertext für das Protokoll (gekürzt) */
  error: string | null;
  /** Argumente und Ergebnis – nur zum Zuordnen, nicht zum Speichern */
  args?: Record<string, unknown>;
  result?: unknown;
}

export interface ServerOptions<C> {
  info: { name: string; title: string; version: string };
  instructions: string;
  tools: ToolDef<C>[];
  prompts?: PromptProvider<C>;
  resources?: ResourceProvider<C>;
  /** Fehler eines Werkzeugs als Text für das Modell. */
  describeError: (err: unknown) => Promise<string>;
  /** Nach „initialize“: welcher Client mit welcher Protokollversion. Fehler hier stören die Antwort nicht. */
  onInitialize?: (client: ClientInfo, ctx: C) => Promise<void> | void;
  /** Hinweis für Clients mit veralteter Protokollversion – wird an die instructions gehängt. */
  outdatedNote?: (requested: string) => string;
  /** Nach jedem Werkzeugaufruf (Protokoll). Fehler hier stören die Antwort nicht. */
  onToolCall?: (call: ToolCallInfo, ctx: C) => Promise<void> | void;
  /** Zusätzlicher Hinweis im Ergebnis eines Werkzeugs – null für keinen. */
  notice?: (tool: string, ctx: C) => Promise<string | null> | string | null;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const ok = (id: Id, result: unknown): RpcResponse => ({ jsonrpc: "2.0", id, result });
export const rpcError = (id: Id | null, code: number, message: string): RpcResponse => ({ jsonrpc: "2.0", id, error: { code, message } });
const shortText = (v: unknown, max = 100) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const ERROR_LOG_MAX = 300;

/** Haken aufrufen, ohne dass ein Fehler darin die eigentliche Antwort verdirbt. */
async function quietly<T>(fn: () => Promise<T> | T): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    console.error("[mcp] hook", err);
    return null;
  }
}

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
  const logCall = (call: ToolCallInfo) => quietly(() => opts.onToolCall?.(call, ctx));

  switch (msg.method) {
    case "initialize": {
      const requested = shortText(params.protocolVersion, 40);
      const supported = requested !== null && (PROTOCOL_VERSIONS as readonly string[]).includes(requested);
      const version = supported ? requested! : PROTOCOL_VERSIONS[0];
      const client = isObject(params.clientInfo) ? params.clientInfo : {};
      await quietly(() => opts.onInitialize?.({ name: shortText(client.name), version: shortText(client.version, 40), protocol: requested, supported }, ctx));
      // Ältere, nicht mehr unterstützte Version: funktioniert weiter, aber mit Bitte ums Aktualisieren
      const outdated = requested && !supported && requested < PROTOCOL_VERSIONS[PROTOCOL_VERSIONS.length - 1] && opts.outdatedNote ? opts.outdatedNote(requested) : null;
      return ok(id, {
        protocolVersion: version,
        capabilities: {
          tools: { listChanged: false },
          ...(opts.prompts ? { prompts: { listChanged: false } } : {}),
          ...(opts.resources ? { resources: { listChanged: false, subscribe: false } } : {}),
        },
        serverInfo: opts.info,
        instructions: outdated ? `${opts.instructions} ${outdated}` : opts.instructions,
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
      if (!tool) {
        const name = shortText(params.name, 80) ?? "?";
        await logCall({ tool: name, ok: false, ms: 0, error: "Unknown tool" });
        return rpcError(id, RPC.INVALID_PARAMS, `Unknown tool: ${String(params.name)}`);
      }
      const args = isObject(params.arguments) ? params.arguments : {};
      const started = Date.now();
      try {
        const out = await tool.run(args, ctx);
        await logCall({ tool: tool.name, ok: true, ms: Date.now() - started, error: null, args, result: out });
        const note = await quietly(() => opts.notice?.(tool.name, ctx) ?? null);
        const content = [{ type: "text", text: typeof out === "string" ? out : JSON.stringify(out, null, 2) }, ...(note ? [{ type: "text", text: note }] : [])];
        return ok(id, { content });
      } catch (err) {
        // Werkzeugfehler gehören ins Ergebnis, damit das Modell sie sieht und reagieren kann
        const text = await opts.describeError(err);
        await logCall({ tool: tool.name, ok: false, ms: Date.now() - started, error: text.slice(0, ERROR_LOG_MAX), args });
        return ok(id, { content: [{ type: "text", text }], isError: true });
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
