import { db } from "./db";
import { buildPrefixQuery, type DocHit, type NoteHit, type SearchResult, type TaskHit } from "./search";

const HEADLINE = "StartSel=⟦, StopSel=⟧, MaxWords=18, MinWords=6, ShortWord=2, MaxFragments=1";

// Volltextsuche über die eigenen Notizen, Aufgaben und Docs mit deutscher
// Stammformbildung: „Webhook“ findet auch „Webhooks“. Die Ausdrücke in den
// WHERE-Klauseln entsprechen exakt den Indizes aus den Migrationen
// (…_fulltext, …_docs) – sonst würde jede Zeile neu berechnet.
export async function searchContent(userId: string, input: string): Promise<SearchResult> {
  const tsq = buildPrefixQuery(input.slice(0, 100));
  if (!tsq) return { notes: [], tasks: [], docs: [] };

  const [notes, tasks, docs] = await Promise.all([
    db.$queryRaw<NoteHit[]>`
      SELECT n."id", n."title", n."projectId", p."name" AS "projectName",
             ts_headline('german', n."content", q, ${HEADLINE}) AS "snippet"
      FROM "Note" n
      JOIN "Project" p ON p."id" = n."projectId",
           to_tsquery('german', ${tsq}) q
      WHERE p."ownerId" = ${userId}
        AND to_tsvector('german', coalesce(n."title", '') || ' ' || n."content") @@ q
      ORDER BY ts_rank(to_tsvector('german', coalesce(n."title", '') || ' ' || n."content"), q) DESC, n."updatedAt" DESC
      LIMIT 10`,
    db.$queryRaw<TaskHit[]>`
      SELECT t."id", t."title", t."status"::text AS "status", t."projectId", p."name" AS "projectName",
             ts_headline('german', t."title" || ' – ' || coalesce(t."description", ''), q, ${HEADLINE}) AS "snippet"
      FROM "Task" t
      JOIN "Project" p ON p."id" = t."projectId",
           to_tsquery('german', ${tsq}) q
      WHERE p."ownerId" = ${userId}
        AND to_tsvector('german', coalesce(t."title", '') || ' ' || coalesce(t."description", '')) @@ q
      ORDER BY ts_rank(to_tsvector('german', coalesce(t."title", '') || ' ' || coalesce(t."description", '')), q) DESC, t."updatedAt" DESC
      LIMIT 10`,
    db.$queryRaw<DocHit[]>`
      SELECT d."id", d."title", d."icon",
             ts_headline('german', d."title" || ' – ' || d."content", q, ${HEADLINE}) AS "snippet"
      FROM "Doc" d,
           to_tsquery('german', ${tsq}) q
      WHERE d."ownerId" = ${userId}
        AND to_tsvector('german', coalesce(d."title", '') || ' ' || d."content") @@ q
      ORDER BY ts_rank(to_tsvector('german', coalesce(d."title", '') || ' ' || d."content"), q) DESC, d."updatedAt" DESC
      LIMIT 10`,
  ]);
  return { notes, tasks, docs };
}
