"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Download, ExternalLink, Expand, GitBranch, Maximize2, Minimize2, MinusCircle, Network, RefreshCw, Search, Stethoscope, StickyNote, Trash2, TriangleAlert, X, XCircle } from "lucide-react";
import type { DiagnoseStep } from "@/lib/git/codeDiagnose";
import { tk } from "@/lib/i18n/messages";
import type { ProjectCodeGraph } from "@/lib/codeGraph";
import { blobUrl } from "@/lib/git/repoCheckLogic";
import { neighborsOf } from "@/lib/codeGraphLogic";
import { api, errorMessage } from "@/lib/client/api";
import { SAVER_FRAME_SKIP, useSaverMode } from "@/lib/client/saverMode";
import { useFormat, useMsg, useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/Toaster";

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

type PNode = { id: string; label: string; kind: "file" | "package" | "memo"; group: string; degree: number };

function colorOf(group: string): string {
  if (group === "packages") return "hsl(215 15% 60%)";
  if (group === "memos") return "hsl(45 95% 60%)";
  let h = 0;
  for (const c of group) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h} 70% 62%)`;
}

export function CodeGraphPanel({ projectId, canEdit = false }: { projectId: string; canEdit?: boolean }) {
  const t = useT("graph");
  const f = useFormat();
  const msg = useMsg();
  const [full, setFull] = useState(false);
  const [branch, setBranch] = useState<string | null>(null);
  const [showMemos, setShowMemos] = useState(true);
  const [memoText, setMemoText] = useState("");
  const [graph, setGraph] = useState<ProjectCodeGraph | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [showPkgs, setShowPkgs] = useState(true);
  const [onlyGroup, setOnlyGroup] = useState<string | null>(null);
  const [, setFrame] = useState(0);
  // Sparmodus auf Handys: Simulation seltener rechnen, das Netz bleibt bedienbar
  const saver = useSaverMode();
  const saverRef = useRef(false);
  saverRef.current = saver;
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const pos = useRef(new Map<string, Pos>());
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ kind: "pan" | "node"; id?: string; sx: number; sy: number; vx: number; vy: number } | null>(null);
  // Touch: aktive Finger für Pinch-Zoom – über native Listener (React-Handler sind
  // passiv, dort würde preventDefault den Seitenzoom nicht stoppen)
  const pinch = useRef<{ dist: number; k: number; x: number; y: number } | null>(null);
  const heat = useRef(0);

  const load = useCallback(async (wanted: string | null = null, refresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({ ...(wanted ? { branch: wanted } : {}), ...(refresh ? { refresh: "1" } : {}) }).toString();
      const res = await api<{ graph: ProjectCodeGraph }>(`/api/projects/${projectId}/graph${query ? `?${query}` : ""}`);
      setBranch(res.graph.branch);
      pos.current = new Map();
      setSelected(null);
      setView({ x: 0, y: 0, k: 1 });
      setGraph(res.graph);
      // Jede Aktion bekommt eine Antwort (#54, #97) – bei Problemen gleich die Prüfung dazu
      if (res.graph.empty) {
        toast(t("fetchFailedToast", { error: msg(res.graph.error ?? tk("graph", "errors.notSynced")) }), "error");
        void runDiagnose();
      } else if (res.graph.staleError) {
        toast(t("staleToast"), "error");
        void runDiagnose();
      } else toast(t("loaded", { files: res.graph.files, commit: (res.graph.commit ?? "").slice(0, 7) }));
    } catch (e) {
      setError(errorMessage(e));
      toast(errorMessage(e), "error");
      void runDiagnose();
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runDiagnose hängt nur an projectId
  }, [projectId, t, msg]);

  const [diagnose, setDiagnose] = useState<DiagnoseStep[] | null>(null);
  const [diagnosing, setDiagnosing] = useState(false);
  async function runDiagnose() {
    setDiagnosing(true);
    try {
      const res = await api<{ diagnose: DiagnoseStep[] }>(`/api/projects/${projectId}/graph?diagnose=1`);
      setDiagnose(res.diagnose);
      const bad = res.diagnose.find((s) => s.state === "error");
      if (bad) toast(t("diagnose.found", { step: t(`diagnose.steps.${bad.key}`), detail: bad.detail ? msg(bad.detail) : "" }), "error");
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setDiagnosing(false);
    }
  }

  const baseNodes = useMemo(
    () => (graph?.nodes ?? []).filter((n) => (showPkgs || n.kind !== "package") && (!onlyGroup || n.group === onlyGroup || (n.kind === "package" && showPkgs))),
    [graph, showPkgs, onlyGroup],
  );
  const baseIds = useMemo(() => new Set(baseNodes.map((n) => n.id)), [baseNodes]);
  // Memo-Netz (#60): jedes Memo ein eigener Punkt an seiner Datei
  const memos = useMemo(() => (showMemos ? (graph?.memos ?? []).filter((m) => baseIds.has(m.file)) : []), [graph, showMemos, baseIds]);
  const nodes = useMemo<PNode[]>(() => [...baseNodes, ...memos.map((m) => ({ id: `memo:${m.id}`, label: m.text.slice(0, 24), kind: "memo" as const, group: "memos", degree: 1 }))], [baseNodes, memos]);
  const ids = useMemo(() => new Set(nodes.map((n) => n.id)), [nodes]);
  const edges = useMemo(
    () => [...(graph?.edges ?? []).filter((e) => ids.has(e.source) && ids.has(e.target)), ...memos.map((m) => ({ source: `memo:${m.id}`, target: m.file }))],
    [graph, ids, memos],
  );
  const groups = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of graph?.nodes ?? []) if (n.kind === "file") m.set(n.group, (m.get(n.group) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [graph]);

  // Startlage: Bereiche im Kreis, damit sich das Netz sichtbar entfaltet
  useEffect(() => {
    if (!nodes.length) return;
    let added = 0;
    const groupIndex = new Map([...new Set(nodes.map((n) => n.group))].map((g, i, all) => [g, (i / all.length) * Math.PI * 2]));
    for (const n of nodes) {
      if (pos.current.has(n.id)) continue;
      added++;
      const memo = n.kind === "memo" ? graph?.memos.find((m) => `memo:${m.id}` === n.id) : null;
      const anchor = memo ? pos.current.get(memo.file) : null;
      if (anchor) {
        pos.current.set(n.id, { x: anchor.x + (Math.random() - 0.5) * 30, y: anchor.y + (Math.random() - 0.5) * 30, vx: 0, vy: 0 });
        continue;
      }
      const a = (groupIndex.get(n.group) ?? 0) + (Math.random() - 0.5) * 0.6;
      const r = 120 + Math.random() * 60;
      pos.current.set(n.id, { x: W / 2 + Math.cos(a) * r, y: H / 2 + Math.sin(a) * r, vx: 0, vy: 0 });
    }
    // Neues Netz: ganz entfalten – ein einzelnes neues Memo: nur leicht nachgeben
    if (added > 20) heat.current = 1;
    else if (added > 0) heat.current = Math.max(heat.current, 0.25);
  }, [nodes, graph]);

  // Simulation: pro Bild ein Schritt, bis sie abgekühlt ist
  useEffect(() => {
    if (!nodes.length) return;
    let raf = 0;
    const list = nodes.map((n) => ({ id: n.id, p: pos.current.get(n.id)!, deg: n.degree }));
    const index = new Map(list.map((n, i) => [n.id, i]));
    const links = edges.map((e) => [index.get(e.source)!, index.get(e.target)!] as const);
    let tick = 0;
    const step = () => {
      // Sparmodus (#mobil): nur jeden dritten Bild rechnen – sieht fast gleich aus, kostet deutlich weniger
      tick++;
      if (saverRef.current && tick % SAVER_FRAME_SKIP !== 0) {
        raf = requestAnimationFrame(step);
        return;
      }
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

  // Mausrad zoomt das Netz – als eigener Listener, sonst scrollt der Browser die Seite (#67)
  // Pinch mit zwei Fingern genauso: native Listener, sonst zoomt der Browser die Seite (#mobil).
  // Wichtig: die Basis der Geste kommt aus einem ref, nicht aus dem Effect-Verschluss –
  // sonst rechnet der Zoom mit dem Stand von beim Mounten und das Netz „fällt zusammen“.
  const hasGraph = Boolean(graph && !graph.empty);
  const viewRef = useRef(view);
  viewRef.current = view;
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const center = (touches: TouchList) => {
      const r = svg.getBoundingClientRect();
      const mx = ((touches[0].clientX + touches[1].clientX) / 2 - r.left) / r.width * W;
      const my = ((touches[0].clientY + touches[1].clientY) / 2 - r.top) / r.height * H;
      return { mx, my, dist: Math.max(1, Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY)) };
    };
    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      drag.current = null;
      if (e.touches.length >= 2) {
        const { dist } = center(e.touches);
        pinch.current = { dist, k: viewRef.current.k, x: viewRef.current.x, y: viewRef.current.y };
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      const base = pinch.current;
      if (!base || e.touches.length !== 2) return;
      e.preventDefault();
      const { mx, my, dist } = center(e.touches);
      const k = Math.min(6, Math.max(0.2, base.k * (dist / base.dist)));
      setView({ k, x: mx - ((mx - base.x) * k) / base.k, y: my - ((my - base.y) * k) / base.k });
    };
    const onTouchEnd = () => {
      pinch.current = null;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = svg.getBoundingClientRect();
      const sx = ((e.clientX - r.left) / r.width) * W;
      const sy = ((e.clientY - r.top) / r.height) * H;
      setView((v) => {
        const k = Math.min(6, Math.max(0.2, v.k * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
        return { k, x: sx - ((sx - v.x) * k) / v.k, y: sy - ((sy - v.y) * k) / v.k };
      });
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    svg.addEventListener("touchstart", onTouchStart, { passive: false });
    svg.addEventListener("touchmove", onTouchMove, { passive: false });
    svg.addEventListener("touchend", onTouchEnd);
    svg.addEventListener("touchcancel", onTouchEnd);
    return () => {
      svg.removeEventListener("wheel", onWheel);
      svg.removeEventListener("touchstart", onTouchStart);
      svg.removeEventListener("touchmove", onTouchMove);
      svg.removeEventListener("touchend", onTouchEnd);
      svg.removeEventListener("touchcancel", onTouchEnd);
    };
    // view im Verschluss: die Geste nimmt die Lage beim Aufsetzen als Basis,
    // deshalb reicht der Stand von hasGraph/full
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasGraph, full]);

  // Vollbild: Esc schließt, danach neu einpassen
  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setFull(false);
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Echter Vollbildmodus, wo erlaubt (Handy): keine Browserleiste mehr, die
    // die Höhe verzieht – sonst bleibt es die Overlay-Ansicht mit h-dvh.
    // Safari (iOS) braucht das herstellerspezifische webkitRequestFullscreen.
    const stage = document.querySelector<HTMLElement>("[data-testid='code-graph-stage']");
    const el = stage as (HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void }) | null;
    try {
      if (el?.requestFullscreen) void el.requestFullscreen().catch(() => {});
      else if (el?.webkitRequestFullscreen) el.webkitRequestFullscreen();
    } catch {
      /* Vollbild verweigert – Overlay-Ansicht bleibt */
    }
    const onFsChange = () => {
      if (!document.fullscreenElement) setFull(false);
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFsChange);
      document.body.style.overflow = overflow;
      const doc = document as Document & { webkitExitFullscreen?: () => void };
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
      else if (doc.webkitExitFullscreen) doc.webkitExitFullscreen();
    };
  }, [full]);

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
    const nb = neighborsOf({ edges }, focus);
    return new Set([focus, ...nb.imports, ...nb.importedBy]);
  }, [focus, graph, edges]);
  const selectedMemo = selected?.startsWith("memo:") ? graph?.memos.find((m) => `memo:${m.id}` === selected) ?? null : null;
  const selectedNode = selected && graph && !selectedMemo ? graph.nodes.find((n) => n.id === selected) ?? null : null;
  const detail = selectedNode && graph ? { node: selectedNode, ...neighborsOf(graph, selectedNode.id), memos: graph.memos.filter((m) => m.file === selectedNode.id) } : null;

  async function memoAction(path: string, init: { method?: string; body?: unknown }) {
    setError(null);
    try {
      const res = await api<{ memos: ProjectCodeGraph["memos"] }>(path, init);
      setGraph((g) => (g ? { ...g, memos: res.memos } : g));
      return true;
    } catch (e) {
      setError(errorMessage(e));
      return false;
    }
  }

  // Vollbild per Portal: im Glas-Panel (backdrop-filter) bliebe „fixed“ im Panel gefangen
  const inStage = (el: React.ReactNode) => (full && typeof document !== "undefined" ? createPortal(el, document.body) : el);
  const hrefOf = (id: string) => (graph && !id.startsWith("pkg:") && graph.webUrl ? blobUrl(graph.webUrl, graph.branch ?? "main", id, null) : null);
  const labelOf = (id: string) => (id.startsWith("pkg:") ? id.slice(4) : id);
  const riskOf = (id: string) => (id.startsWith("pkg:") ? (graph?.packageRisk?.[id.slice(4)] ?? null) : null);

  return (
    <section id="code-graph" className="glass scroll-mt-24 p-6 sm:p-8" aria-labelledby="graph-heading" data-testid="code-graph">
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
        {graph?.commit && (
          <span className="font-mono text-[11px] text-muted" data-testid="code-graph-commit">
            {t("commit", { sha: graph.commit.slice(0, 7) })}
          </span>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          {graph && graph.branches.length > 1 && (
            <label className="flex items-center gap-1 text-xs text-muted">
              <GitBranch size={13} />
              <span className="sr-only">{t("branch")}</span>
              <select className="field w-auto py-1 text-xs" value={branch ?? ""} disabled={loading} onChange={(e) => void load(e.target.value)} data-testid="code-graph-branch">
                {graph.branches.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </label>
          )}
          {graph ? (
            <button type="button" className="btn btn-sm" onClick={() => void load(branch)} disabled={loading}>
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
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button type="button" className="btn btn-sm" onClick={() => void runDiagnose()} disabled={diagnosing} data-testid="code-graph-diagnose">
          <Stethoscope size={14} className={cn(diagnosing && "animate-pulse")} /> {diagnosing ? t("diagnose.running") : t("diagnose.run")}
        </button>
      </div>
      {diagnose && (
        <div className="mb-4 rounded-xl border px-3 py-2 text-sm" data-testid="code-graph-diagnose-result">
          <p className="mb-1 font-medium">{t("diagnose.title")}</p>
          <ul className="space-y-1">
            {diagnose.map((s) => (
              <li key={s.key} className="flex flex-wrap items-start gap-2 text-xs" data-testid={`diagnose-${s.key}`} data-state={s.state}>
                {s.state === "ok" ? (
                  <CheckCircle2 size={14} className="mt-px shrink-0 text-emerald-400" />
                ) : s.state === "warn" ? (
                  <TriangleAlert size={14} className="mt-px shrink-0 text-amber-300" />
                ) : s.state === "error" ? (
                  <XCircle size={14} className="mt-px shrink-0 text-red-400" />
                ) : (
                  <MinusCircle size={14} className="mt-px shrink-0 text-muted" />
                )}
                <span className="min-w-0 flex-1">
                  <b>{t(`diagnose.steps.${s.key}`)}</b>
                  {s.detail && <span className="text-muted"> – {msg(s.detail)}</span>}
                </span>
                {s.state !== "ok" && s.fix === "fetch" && (
                  <button type="button" className="btn btn-sm !py-0" onClick={() => void load(branch, true)} disabled={loading}>
                    {t("diagnose.fix.fetch")}
                  </button>
                )}
                {s.state !== "ok" && (s.fix === "projectAccess" || s.fix === "sync") && (
                  <a className="btn btn-sm !py-0" href="#git">
                    {t(`diagnose.fix.${s.fix}`)}
                  </a>
                )}
                {s.state !== "ok" && s.fix === "account" && (
                  <a className="btn btn-sm !py-0" href="/account#git-zugang">
                    {t("diagnose.fix.account")}
                  </a>
                )}
                {s.state !== "ok" && s.fix === "server" && <span className="text-muted">{t("diagnose.fix.server")}</span>}
              </li>
            ))}
          </ul>
          {diagnose.every((s) => s.state !== "error") && <p className="mt-1 text-xs text-emerald-400">{t("diagnose.allOk")}</p>}
        </div>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
      {graph?.staleError && !graph.empty && (
        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm" data-testid="code-graph-stale">
          <p className="min-w-0 flex-1">{t("stale", { commit: (graph.commit ?? "").slice(0, 7), error: msg(graph.staleError) })}</p>
          <button type="button" className="btn btn-sm" onClick={() => void load(branch, true)} disabled={loading}>
            <Download size={14} /> {t("fetchNow")}
          </button>
        </div>
      )}
      {graph?.empty && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-bg/25 px-3 py-2 text-sm" data-testid="code-graph-empty">
          <p className="min-w-0 flex-1 text-muted">{graph.error ? t("fetchFailed", { error: msg(graph.error) }) : t("empty")}</p>
          <button type="button" className="btn btn-sm" onClick={() => void load(branch, true)} disabled={loading} data-testid="code-graph-fetch">
            <Download size={14} /> {t("fetchNow")}
          </button>
        </div>
      )}

      {graph && !graph.empty && inStage(
        <div className={cn(full && "fixed inset-0 z-50 flex h-dvh flex-col overflow-hidden bg-bg p-3 sm:p-4")} data-testid="code-graph-stage">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <label className="relative">
              <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
              <input className="field w-52 py-1 pl-8 text-sm" placeholder={t("search")} value={query} onChange={(e) => setQuery(e.target.value)} data-testid="code-graph-search" />
            </label>
            <button type="button" className={cn("chip", showPkgs && "chip-active")} onClick={() => setShowPkgs((v) => !v)}>
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: colorOf("packages") }} /> {t("packages")}
            </button>
            <button type="button" className={cn("chip", showMemos && "chip-active")} onClick={() => setShowMemos((v) => !v)} data-testid="code-graph-memos-toggle">
              <span className="inline-block h-2 w-2 rounded-sm" style={{ background: colorOf("memos") }} /> {t("memos")} <span className="text-muted">{graph.memos.length}</span>
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
            <button
              type="button"
              className="btn min-h-11"
              data-testid="code-graph-fullscreen"
              onClick={() => {
                setFull((v) => !v);
                // Nach dem Umschalten auf die neue Größe einpassen
                window.setTimeout(fit, 60);
              }}
            >
              {full ? <Minimize2 size={16} /> : <Expand size={16} />} {full ? t("exitFullscreen") : t("fullscreen")}
            </button>
          </div>

          <div className={cn("grid gap-3 lg:grid-cols-[1fr_18rem]", full && "min-h-0 flex-1 lg:grid-cols-[1fr_22rem]")}>
            <div className={cn("relative overflow-hidden rounded-2xl border bg-bg/40", full && "min-h-0")}>
              <svg
                ref={svgRef}
                viewBox={`0 0 ${W} ${H}`}
                className={cn("block w-full touch-none select-none", full ? "h-full" : "h-[26rem] sm:h-[34rem]")}
                onPointerDown={(e) => {
                  // Fangen immer am SVG, nicht am Punkt – sonst verliert Touch die Bewegung.
                  // Bei zwei Fingern übernimmt der native Touch-Pinch (oben).
                  e.currentTarget.setPointerCapture?.(e.pointerId);
                  if (pinch.current) return;
                  const id = (e.target as Element).getAttribute("data-node");
                  drag.current = id ? { kind: "node", id, sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y } : { kind: "pan", sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y };
                }}
                onPointerMove={(e) => {
                  if (pinch.current) return;
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
                  if (pinch.current) return;
                  const d = drag.current;
                  drag.current = null;
                  if (d && Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) < 5) setSelected(d.kind === "node" ? d.id ?? null : null);
                }}
                onPointerCancel={() => {
                  drag.current = null;
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
                    const r = n.kind === "memo" ? 3.5 : (n.kind === "package" ? 3 : 2.5) + Math.sqrt(n.degree) * 0.9;
                    const dim = (near && !near.has(n.id)) || (matches && !matches.has(n.id));
                    const strong = n.id === focus || matches?.has(n.id);
                    return (
                      <g key={n.id} opacity={dim ? 0.15 : 1}>
                        {n.kind === "memo" ? (
                          <rect
                            data-node={n.id}
                            data-testid="code-graph-memo"
                            x={p.x - r}
                            y={p.y - r}
                            width={r * 2}
                            height={r * 2}
                            rx={1}
                            fill={colorOf("memos")}
                            stroke={strong ? "white" : "none"}
                            strokeWidth={1.5 / view.k}
                            className="cursor-pointer"
                            onPointerEnter={() => setHover(n.id)}
                            onPointerLeave={() => setHover((h) => (h === n.id ? null : h))}
                          >
                            <title>{n.label}</title>
                          </rect>
                        ) : (
                        <circle
                          data-node={n.id}
                          data-testid="code-graph-node"
                          data-risk={riskOf(n.id) ?? undefined}
                          cx={p.x}
                          cy={p.y}
                          r={r}
                          fill={colorOf(n.group)}
                          // Pakete mit Sicherheitslücke rot, mit großem Update gelb umrandet (#105)
                          stroke={strong ? "white" : riskOf(n.id) === "vulnerable" ? "#f87171" : riskOf(n.id) === "major" ? "#fbbf24" : "none"}
                          strokeWidth={(riskOf(n.id) && !strong ? 2 : 1.5) / view.k}
                          className="cursor-pointer"
                          onPointerEnter={() => setHover(n.id)}
                          onPointerLeave={() => setHover((h) => (h === n.id ? null : h))}
                        >
                          <title>{riskOf(n.id) ? `${labelOf(n.id)} – ${t(`risk.${riskOf(n.id)!}`)}` : labelOf(n.id)}</title>
                        </circle>
                        )}
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

            <aside className={cn("rounded-2xl border bg-bg/25 p-3 text-sm", full && "min-h-0 overflow-y-auto")} data-testid="code-graph-detail">
              {selectedMemo ? (
                <div className="space-y-2" data-testid="code-graph-memo-detail">
                  <div className="flex items-start gap-2">
                    <StickyNote size={14} className="mt-0.5 shrink-0 text-amber-300" />
                    <button type="button" className="min-w-0 flex-1 break-all text-left font-mono text-xs hover:text-accent-ink" onClick={() => setSelected(selectedMemo.file)}>
                      {selectedMemo.file}
                    </button>
                    <button type="button" className="btn btn-ghost btn-icon h-6 w-6" onClick={() => setSelected(null)} aria-label={t("close")}>
                      <X size={13} />
                    </button>
                  </div>
                  <p className="whitespace-pre-wrap break-words">{selectedMemo.text}</p>
                  <p className="text-xs text-muted" suppressHydrationWarning>
                    {t(selectedMemo.via === "mcp" ? "memoByAi" : "memoBy", { name: selectedMemo.author ?? "?", ago: f.ago(selectedMemo.at) })}
                  </p>
                  {canEdit && (
                    <button
                      type="button"
                      className="btn btn-sm hover:!text-red-400"
                      onClick={() => void memoAction(`/api/projects/${projectId}/memos/${selectedMemo.id}`, { method: "DELETE" }).then((ok) => void (ok && setSelected(selectedMemo.file)))}
                    >
                      <Trash2 size={13} /> {t("memoDelete")}
                    </button>
                  )}
                </div>
              ) : !detail ? (
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
                  {detail.node.kind === "file" && (
                    <div data-testid="code-graph-file-memos">
                      <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-muted">
                        <StickyNote size={12} className="text-amber-300" /> {t("memoTitle")}
                      </p>
                      {detail.memos.length === 0 ? (
                        <p className="text-xs text-muted">{t("memoEmpty")}</p>
                      ) : (
                        <ul className="space-y-1">
                          {detail.memos.map((m) => (
                            <li key={m.id}>
                              <button type="button" className="w-full rounded-lg border border-amber-400/30 bg-amber-400/5 px-2 py-1 text-left text-xs hover:border-amber-400/60" onClick={() => setSelected(`memo:${m.id}`)}>
                                <span className="line-clamp-3 whitespace-pre-wrap break-words">{m.text}</span>
                                <span className="text-[10px] text-muted" suppressHydrationWarning>
                                  {t(m.via === "mcp" ? "memoByAi" : "memoBy", { name: m.author ?? "?", ago: f.ago(m.at) })}
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                      {canEdit && (
                        <form
                          className="mt-2 space-y-1"
                          onSubmit={(e) => {
                            e.preventDefault();
                            void memoAction(`/api/projects/${projectId}/memos`, { body: { file: detail.node.id, text: memoText } }).then((ok) => void (ok && setMemoText("")));
                          }}
                        >
                          <textarea className="field min-h-16 text-xs" maxLength={2000} placeholder={t("memoPlaceholder")} value={memoText} onChange={(e) => setMemoText(e.target.value)} data-testid="code-graph-memo-input" />
                          <button type="submit" className="btn btn-sm" disabled={!memoText.trim()} data-testid="code-graph-memo-add">
                            <StickyNote size={13} /> {t("memoAdd")}
                          </button>
                        </form>
                      )}
                    </div>
                  )}
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
        </div>,
      )}
    </section>
  );
}
