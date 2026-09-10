import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildInfo } from "@/lib/buildInfo";

export const dynamic = "force-dynamic";

// Wird vom update-Befehl nach jedem Neustart abgefragt: erst wenn App und
// Datenbank antworten, gilt ein Update als erfolgreich – sonst Rollback.
export async function GET() {
  const { version, shortCommit, count } = buildInfo();
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, version, commit: shortCommit, update: count, db: "ok" });
  } catch {
    return NextResponse.json({ ok: false, version, commit: shortCommit, update: count, db: "nicht erreichbar" }, { status: 503 });
  }
}
