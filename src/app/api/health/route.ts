import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { CURRENT_VERSION } from "@/lib/changelog";

export const dynamic = "force-dynamic";

// Wird vom update-Befehl nach jedem Neustart abgefragt: erst wenn App und
// Datenbank antworten, gilt ein Update als erfolgreich – sonst Rollback.
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, version: CURRENT_VERSION, db: "ok" });
  } catch {
    return NextResponse.json({ ok: false, version: CURRENT_VERSION, db: "nicht erreichbar" }, { status: 503 });
  }
}
