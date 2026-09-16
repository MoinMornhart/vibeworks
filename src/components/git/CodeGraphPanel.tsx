"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, Maximize2, Network, RefreshCw, Search, X } from "lucide-react";
import type { ProjectCodeGraph } from "@/lib/codeGraph";
import { blobUrl } from "@/lib/git/repoCheckLogic";
import { neighborsOf } from "@/lib/codeGraphLogic";
import { api, errorMessage } from "@/lib/client/api";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

// Code-Netz (#57): Kräfte-Layout ohne Bibliothek. Knoten stoßen sich ab,
// Importe ziehen zusammen, Bereiche (oberste Ordner) bekommen eine Farbe.

const W = 1000;
const H = 640;

interface Pos {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

function colorOf(group: string): string {
  if (group === "packages") return "hsl(215 15% 60%)";
  let h = 0;
  for (const c of group) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h} 70% 62%)`;
}

export function CodeGraphPanel({ projectId }: { projectId: string }) {
  const t = useT("graph");
  const [graph, setGraph] = useState<ProjectCodeGraph | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [showPkgs, setShowPkgs] = useState(true);
  const [onlyGroup, setOnlyGroup] = useState<string | null>(null);
  const [, setFrame] = useState(0);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const pos = useRef(new Map<string, Pos>());
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ kind: "pan" | "node"; id?: string; sx: number; sy: number; vx: number; vy: number } | null>(null);
  const heat = useRef(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ graph: ProjectCodeGraph }>(`/api/projects/${projectId}/graph`);
      pos.current = new Map();
      setSelected(null);
      setView({ x: 0, y: 0, k: 1 });
      setGraph(res.graph);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const nodes = useMemo(
    () => (graph?.nodes ?? []).filter((n) => (showPkgs || n.kind !== "package") && (!onlyGroup || n.group === onlyGroup || (n.kind === "package" && showPkgs))),
    [graph, showPkgs, onlyGroup],
  );
  const ids = useMemo(() => new Set(nodes.map((n) => n.id)), [nodes]);
  const edges = useMemo(() => (graph?.edges ?? []).filter((e) => ids.has(e.source) && ids.has(e.target)), [graph, ids]);
  const groups = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of graph?.nodes ?? []) if (n.kind === "file") m.set(n.group, (m.get(n.group) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [graph]);

  // Startlage: Bereiche im Kreis, damit sich das Netz sichtbar entfaltet
  useEffect(() => {
    if (!nodes.length) return;
    const groupIndex = new Map([...new Set(nodes.map((n) => n.group))].map((g, i, all) => [g, (i / all.length) * Math.PI * 2]));
    for (const n of nodes) {
      if (pos.current.has(n.id)) continue;
      const a = (groupIndex.get(n.group) ?? 0) + (Math.random() - 0.5) * 0.6;
      const r = 120 + Math.random() * 60;
      pos.current.set(n.id, { x: W / 2 + Math.cos(a) * r, y: H / 2 + Math.sin(a) * r, vx: 0, vy: 0 });
    }
    heat.current = 1;
  }, [nodes]);

  // Simulation: pro Bild ein Schritt, bis sie abgekühlt ist
  useEffect(() => {
    if (!nodes.length) return;
    let raf = 0;
    const list = nodes.map((n) => ({ id: n.id, p: pos.current.get(n.id)!, deg: n.degree }));
    const index = new Map(list.map((n, i) => [n.id, i]));
    const links = edges.map((e) => [index.get(e.source)!, index.get(e.target)!] as const);
    const step = () => {
      const alpha = heat.current;
      if (alpha < 0.02) return;
      const repel = 900 * alpha;
      for (let i = 0; i < list.length; i++) {
        const a = list[i].p;
        for (let j = i + 1; j < list.length; j++) {
          const b = list[j].p;
          let dx = a.x - b.x;
          let dy = a.y - b.y;
          let d2 = dx * dx + dy * dy;
          if (d2 > 90_000) continue;
          if (d2 < 1) {
            dx = Math.random();
            dy = Math.random();
            d2 = 1;
          }
          const f = repel / d2;
          a.vx += dx * f;
          a.vy += dy * f;
          b.vx -= dx * f;
          b.vy -= dy * f;
        }
      }
      for (const [s, tIdx] of links) {
        const a = list[s].p;
        const b = list[tIdx].p;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const f = ((d - 60) / d) * 0.02 * alpha;
        a.vx += dx * f;
        a.vy += dy * f;
        b.vx -= dx * f;
        b.vy -= dy * f;
      }
      for (const n of list) {
        const p = n.p;
        if (drag.current?.kind === "node" && drag.current.id === n.id) continue;
        p.vx += (W / 2 - p.x) * 0.002 * alpha;
        p.vy += (H / 2 - p.y) * 0.002 * alpha;
        p.vx *= 0.6;
        p.vy *= 0.6;
        p.x += Math.max(-20, Math.min(20, p.vx));
        p.y += Math.max(-20, Math.min(20, p.vy));
      }
      heat.current *= 0.985;
      setFrame((f) => f + 1);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [nodes, edges]);

  const toGraph = (clientX: number, clientY: number) => {
    const r = svgRef.current!.getBoundingClientRect();
    const sx = ((clientX - r.left) / r.width) * W;
    const sy = ((clientY - r.top) / r.height) * H;
    return { x: (sx - view.x) / view.k, y: (sy - view.y) / view.k };
  };

  const onWheel = (e: React.WheelEvent) => {
    const r = svgRef.current!.getBoundingClientRect();
    const sx = ((e.clientX - r.left) / r.width) * W;
    const sy = ((e.clientY - r.top) / r.height) * H;
    const k = Math.min(6, Math.max(0.2, view.k * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
    setView({ k, x: sx - ((sx - view.x) * k) / view.k, y: sy - ((sy - view.y) * k) / view.k });
  };

  const fit = () => {
    const ps = nodes.map((n) => pos.current.get(n.id)).filter(Boolean) as Pos[];
    if (!ps.length) return;
    const minX = Math.min(...ps.map((p) => p.x)), maxX = Math.max(...ps.map((p) => p.x));
    const minY = Math.min(...ps.map((p) => p.y)), maxY = Math.max(...ps.map((p) => p.y));
    const k = Math.min(4, 0.9 * Math.min(W / Math.max(1, maxX - minX), H / Math.max(1, maxY - minY)));
    setView({ k, x: W / 2 - ((minX + maxX) / 2) * k, y: H / 2 - ((minY + maxY) / 2) * k });
  };

  // Nach dem Abkühlen einmal einpassen
  const fitted = useRef(false);
  useEffect(() => {
    fitted.current = false;
  }, [graph]);
  useEffect(() => {
    if (!fitted.current && nodes.length && heat.current < 0.05) {
      fitted.current = true;
      fit();
    }
  });

  const q = query.trim().toLowerCase();
  const matches = useMemo(() => (q ? new Set(nodes.filter((n) => n.id.toLowerCase().includes(q)).map((n) => n.id)) : null), [q, nodes]);
  const focus = hover ?? selected;
  const near = useMemo(() => {
    if (!focus || !graph) return null;
    const nb = neighborsOf(graph, focus);
    return new Set([focus, ...nb.imports, ...nb.importedBy]);
  }, [focus, graph]);
  const detail = selected && graph ? { node: graph.nodes.find((n) => n.id === selected)!, ...neighborsOf(graph, selected) } : null;

  const hrefOf = (id: string) => (graph && !id.startsWith("pkg:") && graph.webUrl ? blobUrl(graph.webUrl, graph.branch ?? "main", id, null) : null);
  const labelOf = (id: string) => (id.startsWith("pkg:") ? id.slice(4) : id);

  return (
    <section className="glass p-6 sm:p-8" aria-labelledby="graph-heading" data-testid="code-graph">
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 id="graph-heading" className="flex items-center gap-2 text-lg font-semibold">
          <Network size={18} className="text-accent-ink" /> {t("title")}
        </h2>
        {graph && !graph.empty && (
          <span className="text-xs text-muted" data-testid="code-graph-stats">
            {t("stats", { n: graph.files, files: graph.files, links: graph.edges.length })}
            {graph.hidden > 0 && ` · ${t("hidden", { n: graph.hidden })}`}
          </span>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          {graph ? (
            <button type="button" className="btn btn-sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw size={14} className={cn(loading && "animate-spin")} /> {t("reload")}
            </button>
          ) : (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => void load()} disabled={loading} data-testid="code-graph-load">
              <Network size={14} /> {loading ? t("loading") : t("load")}
            </button>
          )}
        </div>
      </div>
      <p className="mb-4 text-xs text-muted">{t("hint")}</p>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {graph?.empty && <p className="text-sm text-muted">{t("empty")}</p>}

      {graph && !graph.empty && (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <label className="relative">
              <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
              <input className="field w-52 py-1 pl-8 text-sm" placeholder={t("search")} value={query} onChange={(e) => setQuery(e.target.value)} data-testid="code-graph-search" />
            </label>
            <button type="button" className={cn("chip", showPkgs && "chip-active")} onClick={() => setShowPkgs((v) => !v)}>
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: colorOf("packages") }} /> {t("packages")}
            </button>
            <button type="button" className={cn("chip", !onlyGroup && "chip-active")} onClick={() => setOnlyGroup(null)}>
              {t("all")}
            </button>
            {groups.slice(0, 10).map(([g, n]) => (
              <button key={g} type="button" className={cn("chip", onlyGroup === g && "chip-active")} onClick={() => setOnlyGroup(onlyGroup === g ? null : g)} title={t("only")}>
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: colorOf(g) }} /> {g} <span className="text-muted">{n}</span>
              </button>
            ))}
            <button type="button" className="btn btn-sm ml-auto" onClick={fit}>
              <Maximize2 size={13} /> {t("fit")}
            </button>
          </div>

          <div className="grid gap-3 lg:grid-cols-[1fr_18rem]">
            <div className="relative overflow-hidden rounded-2xl border bg-bg/40">
              <svg
                ref={svgRef}
                viewBox={`0 0 ${W} ${H}`}
                className="block h-[26rem] w-full touch-none select-none sm:h-[34rem]"
                onWheel={onWheel}
                onPointerDown={(e) => {
                  (e.target as Element).setPointerCapture?.(e.pointerId);
                  const id = (e.target as Element).getAttribute("data-node");
                  drag.current = id ? { kind: "node", id, sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y } : { kind: "pan", sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y };
                }}
                onPointerMove={(e) => {
                  const d = drag.current;
                  if (!d) return;
                  if (d.kind === "pan") {
                    const r = svgRef.current!.getBoundingClientRect();
                    setView((v) => ({ ...v, x: d.vx + ((e.clientX - d.sx) / r.width) * W, y: d.vy + ((e.clientY - d.sy) / r.height) * H }));
                  } else if (d.id) {
                    const p = pos.current.get(d.id);
                    if (p) Object.assign(p, toGraph(e.clientX, e.clientY), { vx: 0, vy: 0 });
                    heat.current = Math.max(heat.current, 0.3);
                    setFrame((f) => f + 1);
                  }
                }}
                onPointerUp={(e) => {
                  const d = drag.current;
                  drag.current = null;
                  if (d && Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) < 5) setSelected(d.kind === "node" ? d.id ?? null : null);
                }}
                role="img"
                aria-label={t("title")}
              >
                <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
                  {edges.map((e, i) => {
                    const a = pos.current.get(e.source);
                    const b = pos.current.get(e.target);
                    if (!a || !b) return null;
                    const lit = near ? near.has(e.source) && near.has(e.target) && (e.source === focus || e.target === focus) : false;
                    return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={lit ? "var(--vw-accent, #a78bfa)" : "currentColor"} strokeOpacity={lit ? 0.9 : near ? 0.04 : 0.12} strokeWidth={(lit ? 1.6 : 0.7) / Math.sqrt(view.k)} className="text-fg" />;
                  })}
                  {nodes.map((n) => {
                    const p = pos.current.get(n.id);
                    if (!p) return null;
                    const r = (n.kind === "package" ? 3 : 2.5) + Math.sqrt(n.degree) * 0.9;
                    const dim = (near && !near.has(n.id)) || (matches && !matches.has(n.id));
                    const strong = n.id === focus || matches?.has(n.id);
                    return (
                      <g key={n.id} opacity={dim ? 0.15 : 1}>
                        <circle
                          data-node={n.id}
                          data-testid="code-graph-node"
                          cx={p.x}
                          cy={p.y}
                          r={r}
                          fill={colorOf(n.group)}
                          stroke={strong ? "white" : "none"}
                          strokeWidth={1.5 / view.k}
                          className="cursor-pointer"
                          onPointerEnter={() => setHover(n.id)}
                          onPointerLeave={() => setHover((h) => (h === n.id ? null : h))}
                        >
                          <title>{labelOf(n.id)}</title>
                        </circle>
                        {(strong || (near?.has(n.id) && near.size < 40) || (!near && !matches && n.degree > 60)) && (
                          <text x={p.x + r + 2} y={p.y + 3} fontSize={11 / view.k} className="pointer-events-none fill-fg" style={{ paintOrder: "stroke" }} stroke="rgb(0 0 0 / 0.6)" strokeWidth={3 / view.k}>
                            {n.label}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </g>
              </svg>
              <p className="pointer-events-none absolute bottom-2 left-3 text-[11px] text-muted">{t("help")}</p>
            </div>

            <aside className="rounded-2xl border bg-bg/25 p-3 text-sm" data-testid="code-graph-detail">
              {!detail ? (
                <p className="text-xs text-muted">{t("help")}</p>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <span className="mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colorOf(detail.node.group) }} />
                    <div className="min-w-0 flex-1">
                      <p className="break-all font-mono text-xs">{labelOf(detail.node.id)}</p>
                      {detail.node.kind === "package" ? (
                        <p className="text-xs text-muted">{t("package")}</p>
                      ) : (
                        hrefOf(detail.node.id) && (
                          <a href={hrefOf(detail.node.id)!} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-accent-ink hover:underline">
                            {t("openFile")} <ExternalLink size={11} />
                          </a>
                        )
                      )}
                    </div>
                    <button type="button" className="btn btn-ghost btn-icon h-6 w-6" onClick={() => setSelected(null)} aria-label={t("close")}>
                      <X size={13} />
                    </button>
                  </div>
                  {(["imports", "importedBy"] as const).map((k) => (
                    <div key={k}>
                      <p className="mb-1 text-xs font-semibold text-muted">{t(k, { n: detail[k].length })}</p>
                      {detail[k].length === 0 ? (
                        <p className="text-xs text-muted">{t("none")}</p>
                      ) : (
                        <ul className="max-h-48 space-y-0.5 overflow-y-auto">
                          {detail[k].map((id) => (
                            <li key={id}>
                              <button type="button" className="w-full break-all text-left font-mono text-[11px] hover:text-accent-ink" onClick={() => setSelected(id)}>
                                {labelOf(id)}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </aside>
          </div>
        </>
      )}
    </section>
  );
}
