import { db } from "./db";
import { visibleTo } from "./access";
import { buildPrefixQuery, likePattern, mergeHits, type DocHit, type NoteHit, type SearchResult, type TaskHit } from "./search";

const HEADLINE = "StartSel=⟦, StopSel=⟧, MaxWords=18, MinWords=6, ShortWord=2, MaxFragments=1";
const LIMIT = 10;

// Volltextsuche über Notizen und Aufgaben aller sichtbaren Projekte (eigene,
// geteilte, Team) und die eigenen Docs – mit deutscher Stammformbildung:
// „Webhook“ findet auch „Webhooks“. Die Ausdrücke in den WHERE-Klauseln
// entsprechen exakt den Indizes aus den Migrationen (…_fulltext, …_docs).
// Dazu eine Teilwort-Suche im Titel (#109): „hook“ findet „Webhook“.
export async function searchContent(userId: string, input: string): Promise<SearchResult> {
  const text = input.slice(0, 100);
  const tsq = buildPrefixQuery(text);
  if (!tsq) return { notes: [], tasks: [], docs: [] };
  const like = likePattern(text);
  const ids = (await db.project.findMany({ where: visibleTo(userId), select: { id: true } })).map((p) => p.id);
  if (!ids.length && !like) return { notes: [], tasks: [], docs: [] };

  const [notes, tasks, docs, noteTitles, taskTitles, docTitles] = await Promise.all([
    db.$queryRaw<NoteHit[]>`
      SELECT n."id", n."title", n."projectId", p."name" AS "projectName",
             ts_headline('german', n."content", q, ${HEADLINE}) AS "snippet"
      FROM "Note" n
      JOIN "Project" p ON p."id" = n."projectId",
           to_tsquery('german', ${tsq}) q
      WHERE p."id" = ANY(${ids})
        AND to_tsvector('german', coalesce(n."title", '') || ' ' || n."content") @@ q
      ORDER BY ts_rank(to_tsvector('german', coalesce(n."title", '') || ' ' || n."content"), q) DESC, n."updatedAt" DESC
      LIMIT ${LIMIT}`,
    db.$queryRaw<TaskHit[]>`
      SELECT t."id", t."title", t."status"::text AS "status", t."projectId", p."name" AS "projectName",
             ts_headline('german', t."title" || ' – ' || coalesce(t."description", ''), q, ${HEADLINE}) AS "snippet"
      FROM "Task" t
      JOIN "Project" p ON p."id" = t."projectId",
           to_tsquery('german', ${tsq}) q
      WHERE p."id" = ANY(${ids})
        AND to_tsvector('german', coalesce(t."title", '') || ' ' || coalesce(t."description", '')) @@ q
      ORDER BY ts_rank(to_tsvector('german', coalesce(t."title", '') || ' ' || coalesce(t."description", '')), q) DESC, t."updatedAt" DESC
      LIMIT ${LIMIT}`,
    db.$queryRaw<DocHit[]>`
      SELECT d."id", d."title", d."icon",
             ts_headline('german', d."title" || ' – ' || d."content", q, ${HEADLINE}) AS "snippet"
      FROM "Doc" d,
           to_tsquery('german', ${tsq}) q
      WHERE d."ownerId" = ${userId}
        AND to_tsvector('german', coalesce(d."title", '') || ' ' || d."content") @@ q
      ORDER BY ts_rank(to_tsvector('german', coalesce(d."title", '') || ' ' || d."content"), q) DESC, d."updatedAt" DESC
      LIMIT ${LIMIT}`,
    like
      ? db.note.findMany({
          where: { projectId: { in: ids }, title: { contains: like, mode: "insensitive" } },
          orderBy: { updatedAt: "desc" },
          take: LIMIT,
          select: { id: true, title: true, content: true, projectId: true, project: { select: { name: true } } },
        })
      : [],
    like
      ? db.task.findMany({
          where: { projectId: { in: ids }, title: { contains: like, mode: "insensitive" } },
          orderBy: { updatedAt: "desc" },
          take: LIMIT,
          select: { id: true, title: true, status: true, projectId: true, project: { select: { name: true } } },
        })
      : [],
    like
      ? db.doc.findMany({ where: { ownerId: userId, title: { contains: like, mode: "insensitive" } }, orderBy: { updatedAt: "desc" }, take: LIMIT, select: { id: true, title: true, icon: true, content: true } })
      : [],
  ]);
  return {
    notes: mergeHits(notes, noteTitles.map((n) => ({ id: n.id, title: n.title, projectId: n.projectId, projectName: n.project.name, snippet: n.content.slice(0, 140) })), LIMIT),
    tasks: mergeHits(tasks, taskTitles.map((t) => ({ id: t.id, title: t.title, status: t.status, projectId: t.projectId, projectName: t.project.name, snippet: t.title })), LIMIT),
    docs: mergeHits(docs, docTitles.map((d) => ({ id: d.id, title: d.title, icon: d.icon, snippet: d.content.slice(0, 140) })), LIMIT),
  };
}
