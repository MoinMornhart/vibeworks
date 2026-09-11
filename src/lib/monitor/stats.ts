import { db } from "@/lib/db";

// Auswertung für den Live-Bereich der Projektseite: Tage (Europe/Berlin) der
// letzten 30 Tage und Erreichbarkeit über 24 Stunden, 7 und 30 Tage.

export interface LiveDay {
  day: string;
  total: number;
  ok: number;
  ms: number | null;
}

export interface LiveStats {
  days: LiveDay[];
  uptime: { h24: number | null; d7: number | null; d30: number | null };
  /** Ø Antwortzeit erfolgreicher Prüfungen der letzten 24 Stunden */
  avgMs: number | null;
}

const HOUR = 3_600_000;

export async function liveStats(projectId: string): Promise<LiveStats> {
  const now = Date.now();
  const d1 = new Date(now - 24 * HOUR);
  const d7 = new Date(now - 7 * 24 * HOUR);
  const d30 = new Date(now - 30 * 24 * HOUR);
  const [days, totals] = await Promise.all([
    db.$queryRaw<Array<{ day: string; total: bigint; ok: bigint; ms: number | null }>>`
      SELECT to_char(("at" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Berlin', 'YYYY-MM-DD') AS "day",
             count(*) AS "total", count(*) FILTER (WHERE "ok") AS "ok", (avg("ms") FILTER (WHERE "ok"))::float AS "ms"
      FROM "UptimeCheck"
      WHERE "projectId" = ${projectId} AND "at" > ${d30}
      GROUP BY 1 ORDER BY 1`,
    db.$queryRaw<Array<{ t24: bigint; o24: bigint; t7: bigint; o7: bigint; t30: bigint; o30: bigint; ms: number | null }>>`
      SELECT count(*) FILTER (WHERE "at" > ${d1}) AS "t24", count(*) FILTER (WHERE "at" > ${d1} AND "ok") AS "o24",
             count(*) FILTER (WHERE "at" > ${d7}) AS "t7", count(*) FILTER (WHERE "at" > ${d7} AND "ok") AS "o7",
             count(*) AS "t30", count(*) FILTER (WHERE "ok") AS "o30",
             (avg("ms") FILTER (WHERE "at" > ${d1} AND "ok"))::float AS "ms"
      FROM "UptimeCheck"
      WHERE "projectId" = ${projectId} AND "at" > ${d30}`,
  ]);
  const t = totals[0];
  const ratio = (ok: bigint, total: bigint) => (Number(total) ? Number(ok) / Number(total) : null);
  return {
    days: days.map((d) => ({ day: d.day, total: Number(d.total), ok: Number(d.ok), ms: d.ms })),
    uptime: { h24: ratio(t.o24, t.t24), d7: ratio(t.o7, t.t7), d30: ratio(t.o30, t.t30) },
    avgMs: t.ms,
  };
}
