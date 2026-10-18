// Änderungsstempel einer Projektseite (#214): Statt jede Minute die ganze Seite
// neu aufzubauen, fragt der Browser nur diesen kurzen Wert ab. Erst wenn er sich
// ändert, wird neu geladen. Ohne Datenbank, damit es prüfbar bleibt.

type StampPart = string | number | boolean | Date | null | undefined;

/** Einzelteile zu einem kurzen, stabilen Wert verdichten (FNV-1a, 32 Bit). */
export function stampFrom(parts: StampPart[]): string {
  const text = parts.map((p) => (p instanceof Date ? p.getTime() : p ?? "")).join("|");
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}
