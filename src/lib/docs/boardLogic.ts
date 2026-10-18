// Leinwand (#211, Schritt 1): eine freie Fläche mit Zetteln, Textfeldern und
// Formen – verschiebbar, in der Größe änderbar, farbig. Alles ohne Netz und
// Datenbank, damit die Rechnerei prüfbar bleibt.
//
// Gespeichert wird der Inhalt als JSON im Dokument. Er kommt aus dem Browser
// und wird deshalb beim Lesen streng auf erwartete Werte gebracht.

export const BOARD_ITEM_KINDS = ["note", "text", "rect", "ellipse", "line", "image", "ink"] as const;
export type BoardItemKind = (typeof BOARD_ITEM_KINDS)[number];

export const BOARD_COLORS = ["yellow", "green", "blue", "violet", "red", "gray"] as const;
export type BoardColor = (typeof BOARD_COLORS)[number];

export interface BoardItem {
  id: string;
  kind: BoardItemKind;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  color: BoardColor;
  /** Nur bei Bildern: die Kennung des Uploads. Ausgeliefert wird über /api/uploads/<id> –
   *  bewusst keine freie Adresse, damit von der Leinwand nichts Fremdes nachgeladen wird. */
  upload?: string;
  /** Nur bei Freihandstrichen: Punktepaare x,y – gezählt ab der linken oberen Ecke des Elements. */
  points?: number[];
  /** Strichstärke eines Freihandstrichs. */
  size?: number;
  /** Freihand als Marker: dicker und durchscheinend. */
  marker?: boolean;
  /** Drehung in Grad um die Mitte, -180…179. Fehlt bei 0. */
  rotation?: number;
}

export interface Board {
  items: BoardItem[];
}

/** Grenzen der Fläche – großzügig, aber nicht unendlich. */
const BOARD_MIN = -20_000;
export const BOARD_MAX = 20_000;
const BOARD_MIN_SIZE = 24;
const BOARD_MAX_SIZE = 4_000;
export const BOARD_MAX_ITEMS = 500;
const BOARD_MAX_TEXT = 4_000;
/** Punkte je Strich – mehr braucht keine Linie, und es hält den Inhalt klein. */
const BOARD_MAX_POINTS = 400;
export const BOARD_STROKE_SIZES = [2, 4, 8, 16] as const;

const clamp = (v: unknown, min: number, max: number, fallback: number): number => {
  const n = typeof v === "number" && Number.isFinite(v) ? Math.round(v) : fallback;
  return Math.min(max, Math.max(min, n));
};

/** Kennung eines Uploads – dieselbe Form wie in src/lib/uploads.ts, hier ohne Server-Abhängigkeit. */
const UPLOAD_ID = /^[a-z0-9]{8,40}$/;
export const isBoardUpload = (v: unknown): v is string => typeof v === "string" && UPLOAD_ID.test(v);

/** Neues Element in der Mitte des Blicks – Größe passend zur Art. */
export function newBoardItem(kind: BoardItemKind, at: { x: number; y: number }, id: string, upload?: string): BoardItem {
  const size =
    kind === "note" ? { w: 180, h: 140 }
    : kind === "image" ? { w: 260, h: 180 }
    : kind === "text" ? { w: 240, h: 60 }
    : kind === "line" ? { w: 200, h: 2 }
    : { w: 200, h: 140 };
  return {
    id,
    kind,
    x: clamp(at.x - size.w / 2, BOARD_MIN, BOARD_MAX, 0),
    y: clamp(at.y - size.h / 2, BOARD_MIN, BOARD_MAX, 0),
    ...size,
    text: "",
    color: kind === "note" ? "yellow" : "gray",
    ...(kind === "image" && isBoardUpload(upload) ? { upload } : {}),
  };
}

/** Gespeicherten Inhalt einlesen – Unbekanntes fällt weg, alles wird begrenzt. */
export function parseBoard(raw: unknown): Board {
  const src = typeof raw === "string" ? safeJson(raw) : raw;
  const list = Array.isArray((src as { items?: unknown })?.items) ? ((src as { items: unknown[] }).items as unknown[]) : [];
  const items: BoardItem[] = [];
  for (const entry of list.slice(0, BOARD_MAX_ITEMS)) {
    if (!entry || typeof entry !== "object") continue;
    const o = entry as Record<string, unknown>;
    const kind = BOARD_ITEM_KINDS.includes(o.kind as BoardItemKind) ? (o.kind as BoardItemKind) : null;
    const id = typeof o.id === "string" && o.id.length > 0 && o.id.length <= 40 ? o.id : null;
    if (!kind || !id) continue;
    // Ein Bild ohne brauchbare Kennung zeigt nichts – es fällt weg statt als Loch stehen zu bleiben.
    if (kind === "image" && !isBoardUpload(o.upload)) continue;
    // Ein Strich ohne Punkte ebenso.
    const points = kind === "ink" ? readPoints(o.points) : null;
    if (kind === "ink" && !points) continue;
    const rotation = normRotation(o.rotation);
    items.push({
      ...(kind === "image" ? { upload: o.upload as string } : {}),
      ...(points ? { points, size: clamp(o.size, 1, 64, 4), ...(o.marker === true ? { marker: true } : {}) } : {}),
      id,
      kind,
      x: clamp(o.x, BOARD_MIN, BOARD_MAX, 0),
      y: clamp(o.y, BOARD_MIN, BOARD_MAX, 0),
      w: clamp(o.w, BOARD_MIN_SIZE, BOARD_MAX_SIZE, 180),
      h: clamp(o.h, kind === "line" ? 1 : BOARD_MIN_SIZE, BOARD_MAX_SIZE, 140),
      text: typeof o.text === "string" ? o.text.slice(0, BOARD_MAX_TEXT) : "",
      color: BOARD_COLORS.includes(o.color as BoardColor) ? (o.color as BoardColor) : "gray",
      ...(rotation ? { rotation } : {}),
    });
  }
  return { items };
}

/** Punkte eines Strichs streng einlesen: gerade Anzahl, endliche Zahlen, begrenzt. */
function readPoints(raw: unknown): number[] | null {
  if (!Array.isArray(raw) || raw.length < 4) return null;
  const out: number[] = [];
  for (const v of raw.slice(0, BOARD_MAX_POINTS * 2)) {
    if (typeof v !== "number" || !Number.isFinite(v)) return null;
    out.push(Math.round(Math.min(BOARD_MAX_SIZE, Math.max(0, v))));
  }
  if (out.length % 2 !== 0) out.pop();
  return out.length >= 4 ? out : null;
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Element verschieben – bleibt innerhalb der Fläche. */
export function moveItem(item: BoardItem, dx: number, dy: number): BoardItem {
  return { ...item, x: clamp(item.x + dx, BOARD_MIN, BOARD_MAX, item.x), y: clamp(item.y + dy, BOARD_MIN, BOARD_MAX, item.y) };
}

/**
 * Größe über den Griff unten rechts ändern – dx/dy ist der Zug des Zeigers auf
 * der Fläche. Bei einem gedrehten Element zählt der Zug entlang seiner eigenen
 * Kanten, und die gegenüberliegende Ecke bleibt stehen, statt wegzurutschen.
 * Nie kleiner als die Mindestgröße, nie größer als erlaubt.
 */
export function resizeItem(item: BoardItem, dx: number, dy: number): BoardItem {
  const min = item.kind === "line" ? 1 : BOARD_MIN_SIZE;
  const rad = ((item.rotation ?? 0) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  // Zug in die Richtung der eigenen Kanten drehen
  const dw = dx * cos + dy * sin;
  const dh = -dx * sin + dy * cos;
  const w = clamp(item.w + dw, BOARD_MIN_SIZE, BOARD_MAX_SIZE, item.w);
  const h = clamp(item.h + dh, min, BOARD_MAX_SIZE, item.h);
  if (!item.rotation) return { ...item, w, h };
  // Linke obere Ecke (gedreht) festhalten und die neue Mitte von dort aus bestimmen
  const cx = item.x + item.w / 2;
  const cy = item.y + item.h / 2;
  const ax = cx + (-item.w / 2) * cos - (-item.h / 2) * sin;
  const ay = cy + (-item.w / 2) * sin + (-item.h / 2) * cos;
  const nx = ax + (w / 2) * cos - (h / 2) * sin;
  const ny = ay + (w / 2) * sin + (h / 2) * cos;
  return { ...item, w, h, x: clamp(nx - w / 2, BOARD_MIN, BOARD_MAX, item.x), y: clamp(ny - h / 2, BOARD_MIN, BOARD_MAX, item.y) };
}

/** Drehung auf ganze Grad im Bereich -180…179 bringen; Unbrauchbares wird 0. */
export function normRotation(v: unknown): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return 0;
  const r = ((Math.round(v) % 360) + 540) % 360 - 180;
  return r === -0 ? 0 : r;
}

/** Wie nah an 0/90/180/270 Grad die Drehung einrastet. */
const SNAP_DEG = 5;

/**
 * Drehen über den Griff über der Oberkante: Der Winkel ergibt sich aus der Mitte
 * des Elements und dem Zeigepunkt (Flächenkoordinaten). Nahe an einem rechten
 * Winkel rastet er ein, mit `step` (z. B. 15 bei gedrückter Umschalttaste) in Stufen.
 */
export function rotateItem(item: BoardItem, px: number, py: number, step = 0): BoardItem {
  const cx = item.x + item.w / 2;
  const cy = item.y + item.h / 2;
  if (Math.hypot(px - cx, py - cy) < 1) return item;
  // Der Griff sitzt oben – „Zeiger genau über der Mitte“ heißt 0 Grad.
  let deg = (Math.atan2(py - cy, px - cx) * 180) / Math.PI + 90;
  if (step > 0) deg = Math.round(deg / step) * step;
  else {
    const right = Math.round(deg / 90) * 90;
    if (Math.abs(deg - right) <= SNAP_DEG) deg = right;
  }
  const next = { ...item };
  delete next.rotation;
  const rotation = normRotation(deg);
  if (rotation) next.rotation = rotation;
  return next;
}

/** Achsparalleler Rahmen eines Elements – bei Drehung um die gedrehten Ecken. */
function itemExtent(i: BoardItem): { minX: number; minY: number; maxX: number; maxY: number } {
  if (!i.rotation) return { minX: i.x, minY: i.y, maxX: i.x + i.w, maxY: i.y + i.h };
  const rad = (i.rotation * Math.PI) / 180;
  const hw = (Math.abs(Math.cos(rad)) * i.w + Math.abs(Math.sin(rad)) * i.h) / 2;
  const hh = (Math.abs(Math.sin(rad)) * i.w + Math.abs(Math.cos(rad)) * i.h) / 2;
  const cx = i.x + i.w / 2;
  const cy = i.y + i.h / 2;
  // Gerundet – sonst bleibt von cos(90°) ein Rest hinter dem Komma
  return { minX: Math.round(cx - hw), minY: Math.round(cy - hh), maxX: Math.round(cx + hw), maxY: Math.round(cy + hh) };
}

/** Fläche, in der alle Elemente liegen – fürs Einpassen der Ansicht. */
export function boardBounds(items: BoardItem[]): { x: number; y: number; w: number; h: number } | null {
  if (!items.length) return null;
  const ext = items.map(itemExtent);
  const minX = Math.min(...ext.map((e) => e.minX));
  const minY = Math.min(...ext.map((e) => e.minY));
  const maxX = Math.max(...ext.map((e) => e.maxX));
  const maxY = Math.max(...ext.map((e) => e.maxY));
  return { x: minX, y: minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) };
}

/**
 * Kennung für ein neues Element. Bewusst über `crypto.getRandomValues` –
 * `randomUUID` fehlt im Heimnetz über http (kein „Secure Context“).
 */
export function boardId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Inhalt zum Speichern – dieselbe Form, die `parseBoard` wieder einliest. */
export function serializeBoard(items: BoardItem[]): string {
  return JSON.stringify({ items: items.slice(0, BOARD_MAX_ITEMS) });
}

/**
 * Freier Platz für ein neues Element: liegt an der Stelle schon eines,
 * rutscht das neue schrittweise nach unten rechts – sonst verdeckten sich
 * zwei Zettel in der Mitte der Ansicht vollständig.
 */
export function freeSpot(items: BoardItem[], item: BoardItem): BoardItem {
  const belegt = (x: number, y: number) => items.some((i) => Math.abs(i.x - x) < 12 && Math.abs(i.y - y) < 12);
  let { x, y } = item;
  for (let n = 0; n < BOARD_MAX_ITEMS && belegt(x, y); n++) {
    x = clamp(x + 24, BOARD_MIN, BOARD_MAX, x);
    y = clamp(y + 24, BOARD_MIN, BOARD_MAX, y);
  }
  return { ...item, x, y };
}

/**
 * Größe für ein neues Bild: längste Kante 280, Seitenverhältnis bleibt.
 * Ohne brauchbare Maße bleibt es bei der Standardgröße.
 */
export function imageBox(width: number, height: number): { w: number; h: number } {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) return { w: 260, h: 180 };
  const faktor = 280 / Math.max(width, height);
  return {
    w: clamp(width * faktor, BOARD_MIN_SIZE, BOARD_MAX_SIZE, 260),
    h: clamp(height * faktor, BOARD_MIN_SIZE, BOARD_MAX_SIZE, 180),
  };
}

// ── Freihand ────────────────────────────────────────────
// Ein Strich ist ein eigenes Element: `points` liegen im Rahmen 0…w / 0…h,
// gezeichnet wird als SVG. Dadurch verschiebt und skaliert er sich wie jedes
// andere Element, ohne dass die Punkte neu gerechnet werden müssen.

/** Rahmen, in dem die Punkte eines Strichs liegen – der Maßstab beim Zeichnen. */
export function strokeBounds(points: number[]): { w: number; h: number } {
  let w = 1;
  let h = 1;
  for (let i = 0; i + 1 < points.length; i += 2) {
    w = Math.max(w, points[i]);
    h = Math.max(h, points[i + 1]);
  }
  return { w, h };
}

/**
 * Aus gezeichneten Punkten (Flächenkoordinaten) ein Element machen: Der Rahmen
 * bekommt etwas Luft für die Strichstärke, die Punkte werden auf ihn bezogen.
 * Zu kurze Striche (ein Tippen) ergeben `null`.
 */
export function strokeItem(
  punkte: Array<{ x: number; y: number }>,
  id: string,
  color: BoardColor,
  size: number,
  marker = false,
): BoardItem | null {
  const genutzt = punkte.slice(0, BOARD_MAX_POINTS);
  if (genutzt.length < 2) return null;
  const luft = Math.max(2, size);
  const minX = Math.min(...genutzt.map((p) => p.x)) - luft;
  const minY = Math.min(...genutzt.map((p) => p.y)) - luft;
  const maxX = Math.max(...genutzt.map((p) => p.x)) + luft;
  const maxY = Math.max(...genutzt.map((p) => p.y)) + luft;
  const w = clamp(maxX - minX, 1, BOARD_MAX_SIZE, 1);
  const h = clamp(maxY - minY, 1, BOARD_MAX_SIZE, 1);
  const points: number[] = [];
  for (const p of genutzt) {
    points.push(Math.round(clamp(p.x - minX, 0, w, 0)), Math.round(clamp(p.y - minY, 0, h, 0)));
  }
  return {
    id,
    kind: "ink",
    x: clamp(minX, BOARD_MIN, BOARD_MAX, 0),
    y: clamp(minY, BOARD_MIN, BOARD_MAX, 0),
    w,
    h,
    text: "",
    color,
    points,
    size: clamp(size, 1, 64, 4),
    ...(marker ? { marker: true } : {}),
  };
}

/** Abstand eines Punktes zur Strecke a–b – für den Radierer. */
function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len = dx * dx + dy * dy;
  const t = len === 0 ? 0 : Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / len));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Liegt der Punkt (Flächenkoordinaten) nah genug an diesem Strich? */
export function hitsStroke(item: BoardItem, x: number, y: number, radius: number): boolean {
  if (item.kind !== "ink" || !item.points || item.points.length < 4) return false;
  if (item.rotation) {
    // Den Punkt in den ungedrehten Rahmen des Strichs zurückdrehen
    const rad = (-item.rotation * Math.PI) / 180;
    const cx = item.x + item.w / 2;
    const cy = item.y + item.h / 2;
    const rx = cx + (x - cx) * Math.cos(rad) - (y - cy) * Math.sin(rad);
    const ry = cy + (x - cx) * Math.sin(rad) + (y - cy) * Math.cos(rad);
    x = rx;
    y = ry;
  }
  const box = strokeBounds(item.points);
  const sx = item.w / box.w;
  const sy = item.h / box.h;
  const nah = radius + (item.size ?? 4) / 2;
  for (let i = 0; i + 3 < item.points.length; i += 2) {
    const ax = item.x + item.points[i] * sx;
    const ay = item.y + item.points[i + 1] * sy;
    const bx = item.x + item.points[i + 2] * sx;
    const by = item.y + item.points[i + 3] * sy;
    if (distToSegment(x, y, ax, ay, bx, by) <= nah) return true;
  }
  return false;
}

// ── Vorschau für die Übersicht ──────────────────────────
// Die Übersicht aller Leinwände zeigt je Leinwand ein kleines Abbild. Dafür
// reichen Rahmen, Art und Farbe – Text, Punkte und Bilder bleiben auf dem Server.

export interface BoardPreviewShape {
  kind: BoardItemKind;
  /** Lage im Vorschaurahmen 0…100 (x) bzw. 0…`height` (y). */
  x: number;
  y: number;
  w: number;
  h: number;
  color: BoardColor;
  rotation?: number;
}

export interface BoardPreview {
  /** Höhe des Rahmens bei Breite 100 – folgt dem Seitenverhältnis des Inhalts, gekappt. */
  height: number;
  shapes: BoardPreviewShape[];
  count: number;
}

const PREVIEW_MAX_SHAPES = 120;
const round1 = (n: number) => Math.round(n * 10) / 10;

/** Kleines Abbild einer Leinwand – höchstens 120 Formen, auf 100 Breite gebracht. */
export function boardPreview(board: Board): BoardPreview {
  const b = boardBounds(board.items);
  if (!b) return { height: 60, shapes: [], count: 0 };
  const height = Math.min(100, Math.max(30, (b.h / b.w) * 100));
  // Mit etwas Rand einpassen, ohne das Seitenverhältnis zu verzerren
  const scale = Math.min(92 / b.w, (height - 8) / b.h);
  const ox = (100 - b.w * scale) / 2 - b.x * scale;
  const oy = (height - b.h * scale) / 2 - b.y * scale;
  const shapes = board.items.slice(0, PREVIEW_MAX_SHAPES).map((i) => ({
    kind: i.kind,
    x: round1(i.x * scale + ox),
    y: round1(i.y * scale + oy),
    w: Math.max(0.6, round1(i.w * scale)),
    h: Math.max(0.6, round1(i.h * scale)),
    color: i.color,
    ...(i.rotation ? { rotation: i.rotation } : {}),
  }));
  return { height: round1(height), shapes, count: board.items.length };
}
