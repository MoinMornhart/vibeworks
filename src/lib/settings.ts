import { db } from "./db";

export async function getSettings() {
  const existing = await db.settings.findUnique({ where: { id: "instance" } });
  if (existing) return existing;
  return db.settings.upsert({ where: { id: "instance" }, create: { id: "instance" }, update: {} });
}

export async function isSetupDone(): Promise<boolean> {
  const s = await db.settings.findUnique({ where: { id: "instance" }, select: { setupDoneAt: true } });
  return Boolean(s?.setupDoneAt);
}

export async function registrationOpen(): Promise<boolean> {
  const s = await getSettings();
  return s.mode === "MULTI" && s.allowRegistration;
}
