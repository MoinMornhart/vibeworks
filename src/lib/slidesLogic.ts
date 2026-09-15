// Vorstellungs-Folien ohne Datenbank: aus den Angaben eines Projekts eine
// kleine Präsentation bauen – Titel, Abschnitte der Beschreibung, Stand,
// letzte Commits, Live-Seite, nächste Schritte, Schluss.

export interface SlideInput {
  name: string;
  summary: string | null;
  description: string | null;
  owner: string;
  status: string;
  progress: number;
  tags: string[];
  tasks: { todo: number; doing: number; blocked: number; done: number };
  nextTasks: string[];
  commits: Array<{ title: string; author: string; date: string }>;
  liveUrl: string | null;
  repoUrl: string | null;
  cover: string | null;
}

export type Slide =
  | { kind: "title"; title: string; summary: string | null; owner: string; tags: string[]; cover: string | null }
  | { kind: "section"; title: string | null; body: string }
  | { kind: "progress"; status: string; progress: number; tasks: SlideInput["tasks"] }
  | { kind: "commits"; commits: SlideInput["commits"] }
  | { kind: "live"; url: string; cover: string | null }
  | { kind: "next"; tasks: string[] }
  | { kind: "end"; title: string; liveUrl: string | null; repoUrl: string | null };

export const MAX_SECTIONS = 8;
export const MAX_SECTION_TEXT = 1200;

const clip = (s: string) => (s.length > MAX_SECTION_TEXT ? `${s.slice(0, MAX_SECTION_TEXT - 1).trimEnd()}…` : s);

/** Beschreibung an Überschriften (# und ##) in Abschnitte teilen – Codeblöcke bleiben ganz. */
export function splitDescription(md: string | null): Array<{ title: string | null; body: string }> {
  const text = (md ?? "").replace(/\r\n/g, "\n").trim();
  if (!text) return [];
  const sections: Array<{ title: string | null; lines: string[] }> = [];
  let current: { title: string | null; lines: string[] } = { title: null, lines: [] };
  let inCode = false;
  const flush = () => {
    if (current.title !== null || current.lines.join("").trim()) sections.push(current);
  };
  for (const line of text.split("\n")) {
    if (line.trimStart().startsWith("```")) inCode = !inCode;
    const heading = inCode ? null : line.match(/^#{1,2}\s+(.+?)\s*#*\s*$/);
    if (heading) {
      flush();
      current = { title: heading[1], lines: [] };
    } else {
      current.lines.push(line);
    }
  }
  flush();
  return sections.slice(0, MAX_SECTIONS).map((s) => ({ title: s.title, body: clip(s.lines.join("\n").trim()) }));
}

export function buildSlides(i: SlideInput): Slide[] {
  const slides: Slide[] = [{ kind: "title", title: i.name, summary: i.summary, owner: i.owner, tags: i.tags.slice(0, 6), cover: i.cover }];
  for (const s of splitDescription(i.description)) slides.push({ kind: "section", title: s.title, body: s.body });
  slides.push({ kind: "progress", status: i.status, progress: i.progress, tasks: i.tasks });
  if (i.commits.length) slides.push({ kind: "commits", commits: i.commits.slice(0, 5) });
  if (i.liveUrl) slides.push({ kind: "live", url: i.liveUrl, cover: i.cover });
  if (i.nextTasks.length) slides.push({ kind: "next", tasks: i.nextTasks.slice(0, 6) });
  slides.push({ kind: "end", title: i.name, liveUrl: i.liveUrl, repoUrl: i.repoUrl && !i.repoUrl.startsWith("git@") ? i.repoUrl : null });
  return slides;
}
