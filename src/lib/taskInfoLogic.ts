// Info-Fenster einer Aufgabe (#48/#49) – ohne Datenbank: welche Commits
// gehören dazu, und wie lange läuft die Arbeit schon.

export interface CommitLike {
  sha: string;
  title: string;
  body: string;
  author: string;
  date: string;
  url: string | null;
}

/**
 * Commits, die das Issue der Aufgabe nennen („#12“, „Fixes #12“, „Teil von #12“).
 * #12 trifft nicht #123 und auch nicht „abc#12“ mitten in einem Wort.
 */
export function commitsForIssue<T extends CommitLike>(commits: T[], issueNumber: number | null, limit = 20): T[] {
  if (!issueNumber) return [];
  // Fester Ausdruck statt aus der Zahl gebaut (#73): alle „#123“ finden und vergleichen
  const mentions = (text: string) => [...text.matchAll(/(?:^|[^\w/#])#(\d+)(?!\d)/g)].map((m) => Number(m[1]));
  return commits.filter((c) => mentions(c.title).includes(issueNumber) || mentions(c.body ?? "").includes(issueNumber)).slice(0, limit);
}

/** Kurze Dauer: „45 s“, „12 min“, „1 h 05 min“, „3 T 4 h“ – Einheiten je Sprache. */
export function shortDuration(seconds: number, unit: { s: string; min: string; h: string; d: string }): string {
  const s = Math.max(0, Math.floor(seconds));
  if (s < 60) return `${s} ${unit.s}`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} ${unit.min}`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ${unit.h} ${String(m % 60).padStart(2, "0")} ${unit.min}`;
  return `${Math.floor(h / 24)} ${unit.d} ${h % 24} ${unit.h}`;
}

/** Aufgaben-Id aus den Argumenten oder dem Ergebnis eines MCP-Aufrufs. */
export function taskIdOfCall(args: Record<string, unknown> | undefined, result: unknown): string | null {
  const fromArgs = typeof args?.task === "string" ? args.task : null;
  const out = result as { task?: { id?: unknown } } | null | undefined;
  const fromResult = typeof out?.task?.id === "string" ? out.task.id : null;
  const id = fromArgs ?? fromResult;
  return id && /^[\w-]{1,40}$/.test(id) ? id : null;
}
