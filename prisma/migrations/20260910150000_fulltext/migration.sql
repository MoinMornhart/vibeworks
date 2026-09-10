-- Volltextsuche über Notizen und Aufgaben (deutsche Wortstämme).
-- Der Ausdruck muss Zeichen für Zeichen dem in src/app/api/search/route.ts
-- entsprechen, sonst greift der Index nicht und Postgres rechnet
-- to_tsvector für jede Zeile neu.

CREATE INDEX "Note_fulltext_idx" ON "Note"
  USING GIN (to_tsvector('german', coalesce("title", '') || ' ' || "content"));

CREATE INDEX "Task_fulltext_idx" ON "Task"
  USING GIN (to_tsvector('german', coalesce("title", '') || ' ' || coalesce("description", '')));
