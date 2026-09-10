import { db } from "@/lib/db";
import { json, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { buildPrefixQuery, type NoteHit, type SearchResult, type TaskHit } from "@/lib/search";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";

const HEADLINE = "StartSel=⟦, StopSel=⟧, MaxWords=18, MinWords=6, ShortWord=2, MaxFragments=1";

// Volltextsuche über die eigenen Notizen und Aufgaben mit deutscher
// Stammformbildung: „Webhook“ findet auch „Webhooks“. Die Ausdrücke in den
// WHERE-Klauseln entsprechen exakt den Indizes aus der Migration
// 20260910150000_fulltext – sonst würde jede Zeile neu berechnet.
export const GET = route(async (req) => {
  const user = await requireApiUser();
  limitOrThrow(`search:${user.id}`, 120, MINUTE);
  const tsq = buildPrefixQuery((req.nextUrl.searchParams.get("q") ?? "").slice(0, 100));
  if (!tsq) return json({ notes: [], tasks: [] } satisfies SearchResult);

  const [notes, tasks] = await Promise.all([
    db.$queryRaw<NoteHit[]>`
      SELECT n."id", n."title", n."projectId", p."name" AS "projectName",
             ts_headline('german', n."content", q, ${HEADLINE}) AS "snippet"
      FROM "Note" n
      JOIN "Project" p ON p."id" = n."projectId",
           to_tsquery('german', ${tsq}) q
      WHERE p."ownerId" = ${user.id}
        AND to_tsvector('german', coalesce(n."title", '') || ' ' || n."content") @@ q
      ORDER BY ts_rank(to_tsvector('german', coalesce(n."title", '') || ' ' || n."content"), q) DESC, n."updatedAt" DESC
      LIMIT 10`,
    db.$queryRaw<TaskHit[]>`
      SELECT t."id", t."title", t."status"::text AS "status", t."projectId", p."name" AS "projectName",
             ts_headline('german', t."title" || ' – ' || coalesce(t."description", ''), q, ${HEADLINE}) AS "snippet"
      FROM "Task" t
      JOIN "Project" p ON p."id" = t."projectId",
           to_tsquery('german', ${tsq}) q
      WHERE p."ownerId" = ${user.id}
        AND to_tsvector('german', coalesce(t."title", '') || ' ' || coalesce(t."description", '')) @@ q
      ORDER BY ts_rank(to_tsvector('german', coalesce(t."title", '') || ' ' || coalesce(t."description", '')), q) DESC, t."updatedAt" DESC
      LIMIT 10`,
  ]);

  return json({ notes, tasks } satisfies SearchResult);
});
