import { z } from "zod";

// Projektaufbau (#101): eine Tabelle, wie das Projekt aufgebaut ist – Bereich,
// Pfad, Zweck, Funktionsweise. Die KI legt sie per MCP an und hält sie aktuell,
// VibeWorks zeigt sie an und schreibt sie in die CLAUDE.md. Ohne Datenbank.

const MAX_STRUCTURE_ROWS = 80;

const structureRowSchema = z.object({
  area: z.string().trim().min(1).max(80),
  path: z.string().trim().max(200).default(""),
  purpose: z.string().trim().min(1).max(300),
  how: z.string().trim().max(600).default(""),
});
export type StructureRow = z.infer<typeof structureRowSchema>;

export const structureInputSchema = z.object({
  overview: z.string().trim().max(2000).optional(),
  rows: z.array(structureRowSchema).max(MAX_STRUCTURE_ROWS).optional(),
  /** Nur diese Zeilen ergänzen oder ersetzen (gleicher Pfad bzw. Bereich) statt alles zu überschreiben */
  merge: z.boolean().optional(),
  /** Zeilen mit diesen Pfaden oder Bereichen entfernen */
  remove: z.array(z.string().trim().min(1).max(200)).max(MAX_STRUCTURE_ROWS).optional(),
});
export type StructureInput = z.infer<typeof structureInputSchema>;

export interface ProjectStructure {
  overview: string;
  rows: StructureRow[];
  updatedAt: string | null;
  updatedBy: string | null;
}

export const EMPTY_STRUCTURE: ProjectStructure = { overview: "", rows: [], updatedAt: null, updatedBy: null };

/** Gespeicherten Wert tolerant lesen – kaputte Zeilen fallen weg. */
export function readStructure(raw: unknown): ProjectStructure {
  if (!raw || typeof raw !== "object") return EMPTY_STRUCTURE;
  const o = raw as Record<string, unknown>;
  const rows = Array.isArray(o.rows)
    ? o.rows.flatMap((r) => {
        const parsed = structureRowSchema.safeParse(r);
        return parsed.success ? [parsed.data] : [];
      })
    : [];
  return {
    overview: typeof o.overview === "string" ? o.overview : "",
    rows: rows.slice(0, MAX_STRUCTURE_ROWS),
    updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : null,
    updatedBy: typeof o.updatedBy === "string" ? o.updatedBy : null,
  };
}

const rowKey = (r: { area: string; path: string }) => (r.path || r.area).toLowerCase();

/** Neue Fassung aus alter Fassung und Eingabe. */
export function applyStructure(current: ProjectStructure, input: StructureInput, by: string, now = new Date()): ProjectStructure {
  let rows = current.rows;
  if (input.rows) {
    if (input.merge) {
      const next = [...rows];
      for (const row of input.rows) {
        const i = next.findIndex((r) => rowKey(r) === rowKey(row));
        if (i >= 0) next[i] = row;
        else next.push(row);
      }
      rows = next;
    } else rows = input.rows;
  }
  if (input.remove?.length) {
    const gone = new Set(input.remove.map((s) => s.toLowerCase()));
    rows = rows.filter((r) => !gone.has(r.path.toLowerCase()) && !gone.has(r.area.toLowerCase()));
  }
  if (rows.length > MAX_STRUCTURE_ROWS) throw new Error(`At most ${MAX_STRUCTURE_ROWS} rows`);
  return { overview: input.overview ?? current.overview, rows, updatedAt: now.toISOString(), updatedBy: by };
}

/**
 * Vorschläge für Bereiche aus der Dateiliste: Ordner der ersten zwei Ebenen
 * mit Dateianzahl – damit die KI nicht rät, sondern echte Pfade beschreibt.
 */
export function suggestAreas(files: string[], limit = 30): Array<{ path: string; files: number }> {
  const counts = new Map<string, number>();
  for (const f of files) {
    const parts = f.split("/");
    if (parts.length < 2) continue;
    const top = parts[0];
    if (top.startsWith(".") && top !== ".github") continue;
    counts.set(`${top}/`, (counts.get(`${top}/`) ?? 0) + 1);
    if (parts.length > 2) {
      const second = `${top}/${parts[1]}/`;
      counts.set(second, (counts.get(second) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter(([p, n]) => p.split("/").length === 2 || n >= 3)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([path, n]) => ({ path, files: n }));
}

/** Pfade in der Tabelle, die es im Repository nicht (mehr) gibt. */
export function missingPaths(rows: StructureRow[], files: string[]): string[] {
  return rows
    .map((r) => r.path)
    .filter((p) => p && !/[*?]/.test(p))
    .filter((p) => {
      const clean = p.replace(/^\.\//, "").replace(/\/$/, "");
      return !files.some((f) => f === clean || f.startsWith(`${clean}/`));
    });
}

const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/\s*\n\s*/g, " ");

/** Markdown-Tabelle – für CLAUDE.md und die KI. */
export function structureMarkdown(s: ProjectStructure, head: { area: string; path: string; purpose: string; how: string }): string {
  if (!s.rows.length && !s.overview.trim()) return "";
  const out: string[] = [];
  if (s.overview.trim()) out.push(s.overview.trim(), "");
  if (s.rows.length) {
    out.push(`| ${head.area} | ${head.path} | ${head.purpose} | ${head.how} |`, "|---|---|---|---|");
    for (const r of s.rows) out.push(`| ${cell(r.area)} | ${r.path ? `\`${cell(r.path)}\`` : ""} | ${cell(r.purpose)} | ${cell(r.how)} |`);
  }
  return out.join("\n");
}
