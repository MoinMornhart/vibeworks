"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Circle, Copy, Eraser, Expand, Highlighter, ImagePlus, Maximize2, Minus, MousePointer2, Move, Pen, Pencil, Plus, RotateCw, Shrink, Square, StickyNote, Trash2, Type } from "lucide-react";
import {
  BOARD_COLORS,
  BOARD_ITEM_KINDS,
  BOARD_MAX_ITEMS,
  type BoardColor,
  type BoardItem,
  type BoardItemKind,
  boardBounds,
  BOARD_STROKE_SIZES,
  boardId,
  freeSpot,
  hitsStroke,
  imageBox,
  isBoardUpload,
  moveItem,
  newBoardItem,
  parseBoard,
  resizeItem,
  rotateItem,
  serializeBoard,
  strokeBounds,
  strokeItem,
} from "@/lib/docs/boardLogic";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";

// Leinwand (#211): freie Fläche mit Zetteln, Texten und Formen. Der Inhalt geht
// als JSON an denselben Speicherweg wie eine Markdown-Seite – der Editor außen
// entprellt und schickt ihn weg.
//
// Bewegt wird über Zeiger-Ereignisse mit Listenern am Fenster (nicht über
// setPointerCapture): das trägt Maus und Finger gleich gut und hält auch, wenn
// der Zeiger das Element verlässt. Zwei Finger zoomen über die Touch-Ereignisse.
//
// Ein ausgewähltes Element hat eigene Anfasser: oben links zum Verschieben,
// oben in der Mitte zum Drehen, unten rechts für die Größe. Texteingabe und
// Ziehen kommen sich so nicht in die Quere – ein zweites Tippen auf ein
// ausgewähltes Textelement öffnet den Text, auch ohne Doppelklick.

const ICONS: Record<BoardItemKind, typeof StickyNote> = { note: StickyNote, text: Type, rect: Square, ellipse: Circle, line: Minus, image: ImagePlus, ink: Pen };

/** Zeigerwerkzeug: auswählen und schieben, malen oder wegradieren. */
const TOOLS = ["select", "pen", "marker", "eraser"] as const;
type Tool = (typeof TOOLS)[number];
const TOOL_ICONS: Record<Tool, typeof StickyNote> = { select: MousePointer2, pen: Pen, marker: Highlighter, eraser: Eraser };
/** Punktepaare als Angabe für ein SVG-polyline. */
const pairs = (points: number[]): string => {
  let out = "";
  for (let i = 0; i + 1 < points.length; i += 2) out += `${points[i]},${points[i + 1]} `;
  return out.trim();
};

/** Wie nah der Radierer treffen muss – in Flächenpunkten. */
const ERASER_RADIUS = 10;
/** In der Werkzeugleiste ohne „Bild“ – das kommt über die Dateiauswahl daneben. */
const SHAPE_KINDS = BOARD_ITEM_KINDS.filter((k) => k !== "image" && k !== "ink");

const STYLE: Record<BoardColor, { fill: string; ink: string; border: string; soft: string; tint: string; bar: string; dot: string }> = {
  yellow: { fill: "bg-amber-300", ink: "text-neutral-900", border: "border-amber-400", soft: "bg-amber-400/15", tint: "text-amber-300", bar: "bg-amber-400", dot: "bg-amber-300" },
  green: { fill: "bg-emerald-300", ink: "text-neutral-900", border: "border-emerald-400", soft: "bg-emerald-400/15", tint: "text-emerald-300", bar: "bg-emerald-400", dot: "bg-emerald-300" },
  blue: { fill: "bg-sky-300", ink: "text-neutral-900", border: "border-sky-400", soft: "bg-sky-400/15", tint: "text-sky-300", bar: "bg-sky-400", dot: "bg-sky-300" },
  violet: { fill: "bg-violet-300", ink: "text-neutral-900", border: "border-violet-400", soft: "bg-violet-400/15", tint: "text-violet-300", bar: "bg-violet-400", dot: "bg-violet-300" },
  red: { fill: "bg-rose-300", ink: "text-neutral-900", border: "border-rose-400", soft: "bg-rose-400/15", tint: "text-rose-300", bar: "bg-rose-400", dot: "bg-rose-300" },
  gray: { fill: "bg-slate-300", ink: "text-neutral-900", border: "border-slate-400", soft: "bg-slate-400/15", tint: "text-slate-300", bar: "bg-slate-400", dot: "bg-slate-300" },
};

/** Dasselbe Maß wie beim Hintergrundbild – der Server lehnt Größeres ohnehin ab. */
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ZOOM_MIN = 0.3;
const ZOOM_MAX = 3;
type View = { x: number; y: number; z: number };
type Drag =
  | { mode: "pan"; sx: number; sy: number; view: View }
  /** `tapEdit`: Loslassen ohne Bewegung öffnet den Text; `moved` merkt sich, ob wirklich gezogen wurde. */
  | { mode: "move"; id: string; sx: number; sy: number; item: BoardItem; tapEdit?: boolean; moved?: boolean }
  | { mode: "size"; id: string; sx: number; sy: number; item: BoardItem }
  | { mode: "rotate"; id: string; sx: number; sy: number; item: BoardItem };

/** Erst ab dieser Strecke (Bildschirmpunkte) gilt ein Tippen als Ziehen. */
const TAP_SLOP = 4;
/** Elemente mit Text: Zettel, Text, Rechteck, Ellipse. */
const hasText = (kind: BoardItemKind) => kind !== "line" && kind !== "image" && kind !== "ink";

export function BoardCanvas({ value, onChange }: { value: string; onChange: (content: string) => void }) {
  const t = useT("docs");
  const [items, setItems] = useState<BoardItem[]>(() => parseBoard(value).items);
  const [sel, setSel] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [view, setView] = useState<View>({ x: 40, y: 40, z: 1 });
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dropping, setDropping] = useState(false);
  const [tool, setTool] = useState<Tool>("select");
  const [stroke, setStroke] = useState(4);
  const [color, setColor] = useState<BoardColor>("blue");
  // Vollbild: über die Fullscreen-API, sonst (iPhone) als Fläche über der ganzen Seite
  const [full, setFull] = useState(false);
  const shell = useRef<HTMLDivElement>(null);
  // Der Strich, der gerade gezogen wird – erst beim Loslassen wird ein Element daraus.
  const [draft, setDraft] = useState<Array<{ x: number; y: number }> | null>(null);
  const drawing = useRef<Array<{ x: number; y: number }> | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const viewRef = useRef(view);
  viewRef.current = view;
  const drag = useRef<Drag | null>(null);

  const selected = useMemo(() => items.find((i) => i.id === sel) ?? null, [items, sel]);

  /** Änderung übernehmen und nach oben geben. */
  const apply = useCallback(
    (next: BoardItem[]) => {
      setItems(next);
      onChange(serializeBoard(next));
    },
    [onChange],
  );

  const patch = useCallback((id: string, change: (item: BoardItem) => BoardItem) => apply(itemsRef.current.map((i) => (i.id === id ? change(i) : i))), [apply]);

  // ── Zeigepunkt in Flächenkoordinaten ────────────────────
  const toBoard = useCallback((clientX: number, clientY: number) => {
    const box = wrap.current?.getBoundingClientRect();
    const v = viewRef.current;
    return { x: ((clientX - (box?.left ?? 0)) - v.x) / v.z, y: ((clientY - (box?.top ?? 0)) - v.y) / v.z };
  }, []);

  /** Mitte der Ansicht – dort landen neue Elemente. */
  const center = useCallback(() => {
    const box = wrap.current?.getBoundingClientRect();
    return toBoard((box?.left ?? 0) + (box?.width ?? 600) / 2, (box?.top ?? 0) + (box?.height ?? 400) / 2);
  }, [toBoard]);

  function add(kind: BoardItemKind, at?: { x: number; y: number }, upload?: string, box?: { w: number; h: number }) {
    if (itemsRef.current.length >= BOARD_MAX_ITEMS) return;
    const neu = newBoardItem(kind, at ?? center(), boardId(), upload);
    const item = freeSpot(itemsRef.current, box ? { ...neu, ...box, x: neu.x + (neu.w - box.w) / 2, y: neu.y + (neu.h - box.h) / 2 } : neu);
    apply([...itemsRef.current, item]);
    setSel(item.id);
    if (kind === "note" || kind === "text") setEditing(item.id);
  }

  // ── Bilder: hochladen, dann als Element ablegen ─────────
  /**
   * Das Bild geht über den vorhandenen Upload-Weg (`kind: "board"`, zählt
   * getrennt von den Hintergründen). Gespeichert wird nur die Kennung –
   * ausgeliefert wird über `/api/uploads/<id>`, also nichts Fremdes.
   */
  async function addImages(files: File[], at?: { x: number; y: number }) {
    const bilder = files.filter((f) => f.type.startsWith("image/")).slice(0, 10);
    if (!bilder.length) return;
    setBusy(true);
    setUploadError(null);
    let versatz = 0;
    for (const datei of bilder) {
      try {
        if (datei.size > MAX_IMAGE_BYTES) throw new Error(t("editor.board.uploadFailed"));
        // Erst messen, dann senden – nach dem Senden ist der Inhalt nicht mehr sicher lesbar.
        const box = await measure(datei);
        const form = new FormData();
        form.append("file", datei);
        form.append("usage", "board");
        const res = await fetch("/api/uploads", { method: "POST", body: form, credentials: "same-origin" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !isBoardUpload(data?.upload?.id)) throw new Error(data?.error ?? t("editor.board.uploadFailed"));
        const punkt = at ? { x: at.x + versatz, y: at.y + versatz } : undefined;
        add("image", punkt, data.upload.id, box);
        versatz += 24;
      } catch (e) {
        setUploadError(e instanceof Error ? e.message : t("editor.board.uploadFailed"));
        break;
      }
    }
    setBusy(false);
    if (fileInput.current) fileInput.current.value = "";
  }

  function chooseImage() {
    fileInput.current?.click();
  }

  /** Maße des Bildes, damit es nicht verzerrt in einem Standardkasten sitzt. */
  async function measure(datei: File): Promise<{ w: number; h: number }> {
    try {
      const bitmap = await createImageBitmap(datei);
      const box = imageBox(bitmap.width, bitmap.height);
      bitmap.close();
      return box;
    } catch {
      return imageBox(0, 0);
    }
  }

  function duplicate(item: BoardItem) {
    if (itemsRef.current.length >= BOARD_MAX_ITEMS) return;
    const copy = { ...item, id: boardId(), x: item.x + 24, y: item.y + 24 };
    apply([...itemsRef.current, copy]);
    setSel(copy.id);
  }

  function remove(id: string) {
    apply(itemsRef.current.filter((i) => i.id !== id));
    setSel(null);
    setEditing(null);
  }

  // ── Ziehen: Fläche schieben, Element bewegen, Größe ändern ─
  const startDrag = (d: Drag) => {
    drag.current = d;
    const move = (e: PointerEvent) => {
      const cur = drag.current;
      if (!cur) return;
      const dx = e.clientX - cur.sx;
      const dy = e.clientY - cur.sy;
      if (cur.mode === "pan") {
        setView({ ...cur.view, x: cur.view.x + dx, y: cur.view.y + dy });
        return;
      }
      if (cur.mode === "move" && !cur.moved) {
        // Ein kleines Wackeln beim Tippen verschiebt noch nichts
        if (Math.hypot(dx, dy) < TAP_SLOP) return;
        cur.moved = true;
      }
      const z = viewRef.current.z;
      let changed: BoardItem;
      if (cur.mode === "rotate") {
        const p = toBoard(e.clientX, e.clientY);
        changed = rotateItem(cur.item, p.x, p.y, e.shiftKey ? 15 : 0);
      } else changed = cur.mode === "move" ? moveItem(cur.item, dx / z, dy / z) : resizeItem(cur.item, dx / z, dy / z);
      setItems((list) => list.map((i) => (i.id === cur.id ? changed : i)));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      const cur = drag.current;
      drag.current = null;
      if (!cur || cur.mode === "pan") return;
      if (cur.mode === "move" && !cur.moved) {
        if (cur.tapEdit) setEditing(cur.id);
        return;
      }
      onChange(serializeBoard(itemsRef.current));
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  // ── Zeichnen und Radieren ───────────────────────────────
  /** Malt einen Strich, solange der Zeiger unten ist; beim Loslassen wird ein Element daraus. */
  function startStroke(cx: number, cy: number) {
    const punkte = [toBoard(cx, cy)];
    drawing.current = punkte;
    setDraft([...punkte]);
    const move = (e: PointerEvent) => {
      const laufend = drawing.current;
      if (!laufend) return;
      const p = toBoard(e.clientX, e.clientY);
      const letzter = laufend[laufend.length - 1];
      // Nur wirkliche Bewegungen sammeln – das hält den gespeicherten Strich klein.
      if (Math.hypot(p.x - letzter.x, p.y - letzter.y) < 2) return;
      laufend.push(p);
      setDraft([...laufend]);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      const fertig = drawing.current;
      drawing.current = null;
      setDraft(null);
      if (!fertig) return;
      const item = strokeItem(fertig, boardId(), color, tool === "marker" ? stroke * 2 : stroke, tool === "marker");
      if (item && itemsRef.current.length < BOARD_MAX_ITEMS) apply([...itemsRef.current, item]);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  }

  /** Radiert ganze Striche weg, die unter dem Zeiger liegen. */
  function startErase(cx: number, cy: number) {
    let etwasWeg = false;
    const weg = (x: number, y: number) => {
      const p = toBoard(x, y);
      const rest = itemsRef.current.filter((i) => !hitsStroke(i, p.x, p.y, ERASER_RADIUS));
      if (rest.length !== itemsRef.current.length) {
        etwasWeg = true;
        setItems(rest);
        itemsRef.current = rest;
      }
    };
    weg(cx, cy);
    const move = (e: PointerEvent) => weg(e.clientX, e.clientY);
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      if (etwasWeg) onChange(serializeBoard(itemsRef.current));
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  }

  // ── Zoom: Rad mit Strg, zwei Finger, Knöpfe ─────────────
  const zoomAt = useCallback((factor: number, clientX?: number, clientY?: number) => {
    setView((v) => {
      const z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, v.z * factor));
      const box = wrap.current?.getBoundingClientRect();
      const px = clientX === undefined ? (box?.width ?? 0) / 2 : clientX - (box?.left ?? 0);
      const py = clientY === undefined ? (box?.height ?? 0) / 2 : clientY - (box?.top ?? 0);
      // Der Punkt unter dem Zeiger bleibt stehen.
      return { z, x: px - ((px - v.x) / v.z) * z, y: py - ((py - v.y) / v.z) * z };
    });
  }, []);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) zoomAt(e.deltaY < 0 ? 1.1 : 1 / 1.1, e.clientX, e.clientY);
      else setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
    };
    let pinch: { dist: number; z: number; x: number; y: number; cx: number; cy: number } | null = null;
    const dist = (a: Touch, b: Touch) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      drag.current = null; // Zwei Finger heben ein begonnenes Ziehen auf.
      const box = el.getBoundingClientRect();
      const v = viewRef.current;
      pinch = {
        dist: dist(e.touches[0], e.touches[1]),
        z: v.z,
        x: v.x,
        y: v.y,
        cx: (e.touches[0].clientX + e.touches[1].clientX) / 2 - box.left,
        cy: (e.touches[0].clientY + e.touches[1].clientY) / 2 - box.top,
      };
    };
    const onMove = (e: TouchEvent) => {
      if (!pinch || e.touches.length !== 2) return;
      e.preventDefault();
      const z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, (pinch.z * dist(e.touches[0], e.touches[1])) / pinch.dist));
      setView({ z, x: pinch.cx - ((pinch.cx - pinch.x) / pinch.z) * z, y: pinch.cy - ((pinch.cy - pinch.y) / pinch.z) * z });
    };
    const onEnd = () => {
      pinch = null;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("touchstart", onStart, { passive: false });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
    };
  }, [zoomAt]);

  /** Alles ins Bild holen. */
  const fitView = useCallback(() => {
    const box = wrap.current?.getBoundingClientRect();
    const b = boardBounds(itemsRef.current);
    if (!box) return;
    if (!b) {
      setView({ x: 40, y: 40, z: 1 });
      return;
    }
    const z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.min((box.width - 64) / b.w, (box.height - 64) / b.h, 1.5)));
    setView({ z, x: (box.width - b.w * z) / 2 - b.x * z, y: (box.height - b.h * z) / 2 - b.y * z });
  }, []);

  // Beim Öffnen einmal einpassen, damit gespeicherte Inhalte sichtbar sind.
  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current) return;
    fitted.current = true;
    if (itemsRef.current.length) fitView();
  }, [fitView]);

  // ── Vollbild ────────────────────────────────────────────
  // Wie im CI-Designer: Der Browser meldet das Ende über fullscreenchange.
  // Ohne Fullscreen-API bleibt die Fläche als Overlay über der Seite.
  useEffect(() => {
    if (!full) return;
    const onFsChange = () => {
      if (!document.fullscreenElement) setFull(false);
    };
    document.addEventListener("fullscreenchange", onFsChange);
    try {
      const el = shell.current as (HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void }) | null;
      if (el?.requestFullscreen) void el.requestFullscreen().catch(() => {});
      else if (el?.webkitRequestFullscreen) el.webkitRequestFullscreen();
    } catch {
      /* Vollbild verweigert – Overlay-Ansicht bleibt */
    }
    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
      const doc = document as Document & { webkitExitFullscreen?: () => void };
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
      else if (doc.webkitExitFullscreen) doc.webkitExitFullscreen();
    };
  }, [full]);

  // ── Tasten ──────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (editing) {
        if (e.key === "Escape") setEditing(null);
        return;
      }
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      // Esc hebt erst die Auswahl auf, dann das Vollbild (Overlay-Fall)
      if (e.key === "Escape") {
        if (sel) setSel(null);
        else if (full) setFull(false);
      } else if ((e.key === "Delete" || e.key === "Backspace") && sel) {
        e.preventDefault();
        remove(sel);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, editing, full]);

  // Bild aus der Zwischenablage einfügen – nur, solange kein Text bearbeitet wird.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (editing) return;
      const dateien = Array.from(e.clipboardData?.files ?? []);
      if (!dateien.length) return;
      e.preventDefault();
      void addImages(dateien);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  // Anfasser bleiben auf dem Bildschirm gleich groß, egal wie weit gezoomt ist
  const grip = 16 / view.z;
  const handle = 26 / view.z;

  return (
    <div
      ref={shell}
      data-board-shell
      data-board-full={full || undefined}
      className={cn("flex min-h-0 flex-col gap-2", full && "fixed inset-0 z-50 bg-bg p-2 sm:p-3")}
      style={full ? { paddingTop: "max(0.5rem, env(safe-area-inset-top))", paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))", paddingLeft: "max(0.5rem, env(safe-area-inset-left))", paddingRight: "max(0.5rem, env(safe-area-inset-right))" } : undefined}
    >
      {/* Werkzeuge – bleiben im Vollbild oben stehen und liegen über der Fläche */}
      <div className="relative z-10 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border bg-bg/40 p-0.5" role="radiogroup" aria-label={t("editor.board.label")}>
          {TOOLS.map((w) => {
            const Icon = TOOL_ICONS[w];
            return (
              <button
                key={w}
                type="button"
                role="radio"
                aria-checked={tool === w}
                data-board-tool={w}
                className={cn("rounded-md p-1.5", tool === w ? "bg-accent text-on-accent" : "text-muted hover:bg-fg/10 hover:text-fg")}
                onClick={() => {
                  setTool(w);
                  setSel(null);
                  setEditing(null);
                }}
                title={t(`editor.board.tools.${w}`)}
                aria-label={t(`editor.board.tools.${w}`)}
              >
                <Icon size={16} />
              </button>
            );
          })}
        </div>
        {(tool === "pen" || tool === "marker") && (
          <div className="fade-in flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-lg border bg-bg/40 p-0.5" aria-label={t("editor.board.strokeSize")}>
              {BOARD_STROKE_SIZES.map((n) => (
                <button
                  key={n}
                  type="button"
                  data-board-stroke={n}
                  onClick={() => setStroke(n)}
                  className={cn("flex h-7 w-7 items-center justify-center rounded-md", stroke === n ? "bg-accent/20" : "hover:bg-fg/10")}
                  title={t("editor.board.strokeSizeValue", { n })}
                  aria-label={t("editor.board.strokeSizeValue", { n })}
                >
                  <span className="rounded-full bg-fg" style={{ width: Math.min(14, n + 2), height: Math.min(14, n + 2) }} />
                </button>
              ))}
            </div>
            <div className="flex rounded-lg border bg-bg/40 p-0.5" aria-label={t("editor.board.color")}>
              {BOARD_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  data-board-ink-color={c}
                  onClick={() => setColor(c)}
                  className={cn("m-0.5 h-5 w-5 rounded-full border border-fg/20", STYLE[c].dot, color === c && "ring-2 ring-accent ring-offset-1 ring-offset-bg")}
                  title={t(`editor.board.colors.${c}`)}
                  aria-label={t(`editor.board.colors.${c}`)}
                />
              ))}
            </div>
          </div>
        )}
        <div className={cn("flex rounded-lg border bg-bg/40 p-0.5", tool !== "select" && "hidden")} role="toolbar" aria-label={t("editor.board.add")}>
          {SHAPE_KINDS.map((kind) => {
            const Icon = ICONS[kind];
            return (
              <button
                key={kind}
                type="button"
                data-board-add={kind}
                className="rounded-md p-1.5 text-muted hover:bg-fg/10 hover:text-fg"
                onClick={() => add(kind)}
                title={t(`editor.board.kinds.${kind}`)}
                aria-label={t("editor.board.addKind", { kind: t(`editor.board.kinds.${kind}`) })}
              >
                <Icon size={16} />
              </button>
            );
          })}
          <button
            type="button"
            data-board-add="image"
            className="rounded-md p-1.5 text-muted hover:bg-fg/10 hover:text-fg disabled:opacity-40"
            onClick={chooseImage}
            disabled={busy}
            title={t("editor.board.addImage")}
            aria-label={t("editor.board.addImage")}
          >
            <ImagePlus size={16} />
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp,image/avif"
            multiple
            hidden
            onChange={(e) => void addImages(Array.from(e.target.files ?? []))}
          />
        </div>
        <div className="flex items-center rounded-lg border bg-bg/40 p-0.5">
          <button type="button" className="rounded-md p-1.5 text-muted hover:bg-fg/10 hover:text-fg" onClick={() => zoomAt(1 / 1.2)} title={t("editor.board.zoomOut")} aria-label={t("editor.board.zoomOut")}>
            <Minus size={16} />
          </button>
          <span className="w-12 text-center text-xs text-muted" aria-hidden>{Math.round(view.z * 100)}%</span>
          <button type="button" className="rounded-md p-1.5 text-muted hover:bg-fg/10 hover:text-fg" onClick={() => zoomAt(1.2)} title={t("editor.board.zoomIn")} aria-label={t("editor.board.zoomIn")}>
            <Plus size={16} />
          </button>
          <button type="button" data-board-fit className="rounded-md p-1.5 text-muted hover:bg-fg/10 hover:text-fg" onClick={fitView} title={t("editor.board.fit")} aria-label={t("editor.board.fit")}>
            <Maximize2 size={15} />
          </button>
          <button
            type="button"
            data-board-fullscreen
            aria-pressed={full}
            className={cn("rounded-md p-1.5 hover:bg-fg/10 hover:text-fg", full ? "text-accent-ink" : "text-muted")}
            onClick={() => setFull((f) => !f)}
            title={full ? t("editor.board.exitFullscreen") : t("editor.board.fullscreen")}
            aria-label={full ? t("editor.board.exitFullscreen") : t("editor.board.fullscreen")}
          >
            {full ? <Shrink size={15} /> : <Expand size={15} />}
          </button>
        </div>
        {selected && (
          <div className="fade-in flex flex-wrap items-center gap-2">
            {/* Ein Bild hat keine eigene Farbe. */}
            {selected.kind !== "image" && (
            <div className="flex rounded-lg border bg-bg/40 p-0.5" aria-label={t("editor.board.color")}>
              {BOARD_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  data-board-color={c}
                  onClick={() => patch(selected.id, (i) => ({ ...i, color: c }))}
                  className={cn("m-0.5 h-5 w-5 rounded-full border border-fg/20", STYLE[c].dot, selected.color === c && "ring-2 ring-accent ring-offset-1 ring-offset-bg")}
                  title={t(`editor.board.colors.${c}`)}
                  aria-label={t(`editor.board.colors.${c}`)}
                />
              ))}
            </div>
            )}
            <div className="flex rounded-lg border bg-bg/40 p-0.5">
              {hasText(selected.kind) && (
                <button type="button" data-board-edit className="rounded-md p-1.5 text-muted hover:bg-fg/10 hover:text-fg" onClick={() => setEditing(selected.id)} title={t("editor.board.edit")} aria-label={t("editor.board.edit")}>
                  <Pencil size={15} />
                </button>
              )}
              {selected.rotation ?
                <button type="button" data-board-unrotate className="rounded-md p-1.5 text-muted hover:bg-fg/10 hover:text-fg" onClick={() => patch(selected.id, (i) => { const next = { ...i }; delete next.rotation; return next; })} title={t("editor.board.straighten")} aria-label={t("editor.board.straighten")}>
                  <RotateCw size={15} className="-scale-x-100" />
                </button>
              : null}
              <button type="button" data-board-copy className="rounded-md p-1.5 text-muted hover:bg-fg/10 hover:text-fg" onClick={() => duplicate(selected)} title={t("editor.board.duplicate")} aria-label={t("editor.board.duplicate")}>
                <Copy size={15} />
              </button>
              <button type="button" data-board-delete className="rounded-md p-1.5 text-muted hover:bg-red-500/15 hover:text-red-400" onClick={() => remove(selected.id)} title={t("editor.board.delete")} aria-label={t("editor.board.delete")}>
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        )}
        <span className="ml-auto text-xs text-muted">
          {busy ? t("editor.board.uploading") : t("editor.board.items", { n: items.length })}
        </span>
      </div>

      {/* Fläche */}
      <div
        ref={wrap}
        data-board-canvas
        className={cn("relative touch-none select-none overflow-hidden rounded-xl border bg-bg/30", full ? "min-h-0 flex-1" : "h-[60vh] min-h-80", dropping && "border-accent")}
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes("Files")) return;
          e.preventDefault();
          setDropping(true);
        }}
        onDragLeave={() => setDropping(false)}
        onDrop={(e) => {
          if (!e.dataTransfer.files.length) return;
          e.preventDefault();
          setDropping(false);
          void addImages(Array.from(e.dataTransfer.files), toBoard(e.clientX, e.clientY));
        }}
        style={{
          backgroundImage: "radial-gradient(rgb(148 163 184 / 0.25) 1px, transparent 1px)",
          backgroundSize: `${24 * view.z}px ${24 * view.z}px`,
          backgroundPosition: `${view.x}px ${view.y}px`,
        }}
        onPointerDown={(e) => {
          if (e.button !== 0 && e.pointerType === "mouse") return;
          setSel(null);
          setEditing(null);
          if (tool === "pen" || tool === "marker") {
            startStroke(e.clientX, e.clientY);
            return;
          }
          if (tool === "eraser") {
            startErase(e.clientX, e.clientY);
            return;
          }
          startDrag({ mode: "pan", sx: e.clientX, sy: e.clientY, view: viewRef.current });
        }}
        role="application"
        aria-label={t("editor.board.label")}
      >
        <div className="absolute left-0 top-0 origin-top-left" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.z})` }}>
          {items.map((item) => {
            const s = STYLE[item.color];
            const active = item.id === sel;
            return (
              <div
                key={item.id}
                data-board-item={item.id}
                className={cn(
                  "absolute",
                  item.kind === "note" && cn("rounded-xl p-2 shadow-lg", s.fill, s.ink),
                  item.kind === "text" && cn("p-1 font-semibold", s.tint),
                  item.kind === "rect" && cn("rounded-lg border-2 p-2", s.border, s.soft),
                  item.kind === "ellipse" && cn("rounded-[50%] border-2 p-2", s.border, s.soft),
                  item.kind === "line" && cn("rounded-full", s.bar),
                  item.kind === "image" && "overflow-hidden rounded-lg bg-fg/5 shadow-lg",
                  active && "outline-2 outline-offset-2 outline-accent",
                )}
                style={{ left: item.x, top: item.y, width: item.w, height: item.h, transform: item.rotation ? `rotate(${item.rotation}deg)` : undefined }}
                onPointerDown={(e) => {
                  if (e.button !== 0 && e.pointerType === "mouse") return;
                  // Beim Zeichnen und Radieren gehört das Ereignis der Fläche.
                  if (tool !== "select") return;
                  e.stopPropagation();
                  // Zweites Tippen auf ein schon gewähltes Textelement öffnet den Text
                  const tapEdit = sel === item.id && editing !== item.id && hasText(item.kind);
                  setSel(item.id);
                  if (editing !== item.id) setEditing(null);
                  startDrag({ mode: "move", id: item.id, sx: e.clientX, sy: e.clientY, item, tapEdit });
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  if (hasText(item.kind)) setEditing(item.id);
                }}
              >
                {/* Linien sind dünn – diese Fläche macht sie treffbar. */}
                {item.kind === "line" && <span className="absolute -inset-y-2 inset-x-0" />}
                {item.kind === "ink" && item.points ?
                  <svg
                    viewBox={`0 0 ${strokeBounds(item.points).w} ${strokeBounds(item.points).h}`}
                    preserveAspectRatio="none"
                    className="pointer-events-none h-full w-full overflow-visible"
                    aria-hidden
                  >
                    <polyline
                      points={pairs(item.points)}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={item.size ?? 4}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={cn(s.tint, item.marker && "opacity-50")}
                    />
                  </svg>
                : item.kind === "image" && item.upload ?
                  // eslint-disable-next-line @next/next/no-img-element -- eigener Upload, feste Größe auf der Fläche
                  <img
                    src={`/api/uploads/${encodeURIComponent(item.upload)}`}
                    alt={item.text || t("editor.board.imageAlt")}
                    className="pointer-events-none h-full w-full object-contain"
                    draggable={false}
                  />
                : editing === item.id ?
                  <textarea
                    autoFocus
                    data-board-text
                    className={cn("h-full w-full resize-none bg-transparent text-[14px] leading-snug outline-none", item.kind === "note" ? s.ink : "text-fg")}
                    value={item.text}
                    onChange={(e) => patch(item.id, (i) => ({ ...i, text: e.target.value }))}
                    onPointerDown={(e) => e.stopPropagation()}
                    onBlur={() => setEditing(null)}
                    placeholder={t("editor.board.textPlaceholder")}
                    aria-label={t("editor.board.textLabel")}
                  />
                : hasText(item.kind) ?
                  <p className={cn("h-full overflow-hidden whitespace-pre-wrap break-words text-[14px] leading-snug", (item.kind === "rect" || item.kind === "ellipse") && "flex items-center justify-center text-center")}>
                    {item.text}
                  </p>
                : null}
                {active && (
                  <>
                    <span
                      data-board-grip
                      className="absolute cursor-se-resize rounded-sm border border-bg bg-accent"
                      style={{ width: grip, height: grip, right: -grip / 2, bottom: -grip / 2 }}
                      onPointerDown={(e) => {
                        if (e.button !== 0 && e.pointerType === "mouse") return;
                        e.stopPropagation();
                        startDrag({ mode: "size", id: item.id, sx: e.clientX, sy: e.clientY, item });
                      }}
                    />
                    {/* Verschieben – auch während der Text offen ist */}
                    <span
                      data-board-move
                      role="button"
                      aria-label={t("editor.board.move")}
                      title={t("editor.board.move")}
                      className="absolute flex cursor-move items-center justify-center rounded-full border border-bg bg-accent text-on-accent shadow"
                      style={{ width: handle, height: handle, left: -handle / 2, top: -handle / 2 }}
                      onPointerDown={(e) => {
                        if (e.button !== 0 && e.pointerType === "mouse") return;
                        e.stopPropagation();
                        e.preventDefault();
                        startDrag({ mode: "move", id: item.id, sx: e.clientX, sy: e.clientY, item, moved: true });
                      }}
                    >
                      <Move size={14 / view.z} />
                    </span>
                    {/* Drehen – Strich und Griff über der Oberkante */}
                    <span className="pointer-events-none absolute left-1/2 w-px bg-accent" style={{ top: -handle * 1.2, height: handle * 1.2 }} aria-hidden />
                    <span
                      data-board-rotate
                      role="button"
                      aria-label={t("editor.board.rotate")}
                      title={t("editor.board.rotate")}
                      className="absolute left-1/2 flex cursor-grab items-center justify-center rounded-full border border-bg bg-accent text-on-accent shadow"
                      style={{ width: handle, height: handle, top: -handle * 1.7, marginLeft: -handle / 2 }}
                      onPointerDown={(e) => {
                        if (e.button !== 0 && e.pointerType === "mouse") return;
                        e.stopPropagation();
                        e.preventDefault();
                        startDrag({ mode: "rotate", id: item.id, sx: e.clientX, sy: e.clientY, item });
                      }}
                    >
                      <RotateCw size={14 / view.z} />
                    </span>
                  </>
                )}
              </div>
            );
          })}
          {/* Der Strich, der gerade gezogen wird */}
          {draft && draft.length > 1 && (
            <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width="1" height="1" aria-hidden>
              <polyline
                points={draft.map((p) => `${Math.round(p.x)},${Math.round(p.y)}`).join(" ")}
                fill="none"
                stroke="currentColor"
                strokeWidth={tool === "marker" ? stroke * 2 : stroke}
                strokeLinecap="round"
                strokeLinejoin="round"
                className={cn(STYLE[color].tint, tool === "marker" && "opacity-50")}
              />
            </svg>
          )}
        </div>
        {items.length === 0 && !dropping && (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-muted">{t("editor.board.empty")}</p>
        )}
        {dropping && (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center bg-accent/10 p-6 text-center text-sm font-medium">{t("editor.board.dropHere")}</p>
        )}
      </div>
      {uploadError && (
        <p role="alert" data-board-error className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-400">{uploadError}</p>
      )}
      <p className="text-xs text-muted">{tool === "select" ? t("editor.board.hint") : t("editor.board.drawHint")}</p>
    </div>
  );
}
