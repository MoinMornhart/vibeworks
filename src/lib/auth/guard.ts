import { cache } from "react";
import { redirect } from "next/navigation";
import { ApiError } from "@/lib/api";
import { readSessionToken, validateSession } from "./session";

// Die eigentliche Sicherheitsgrenze: jede Seite und jeder Endpunkt prüft
// die Sitzung hier gegen die Datenbank. Die Middleware sieht nur, ob
// überhaupt ein Cookie mitkommt.

export const getAuth = cache(async () => {
  const token = await readSessionToken();
  if (!token) return null;
  return validateSession(token);
});

export type SessionUser = NonNullable<Awaited<ReturnType<typeof getAuth>>>["user"];

export async function currentUser(): Promise<SessionUser | null> {
  return (await getAuth())?.user ?? null;
}

export async function requirePageUser(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requirePageAdmin(): Promise<SessionUser> {
  const user = await requirePageUser();
  if (user.role !== "ADMIN") redirect("/");
  return user;
}

export async function requireApiUser(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) throw new ApiError(401, "errors.notLoggedIn");
  return user;
}

export async function requireApiAdmin(): Promise<SessionUser> {
  const user = await requireApiUser();
  if (user.role !== "ADMIN") throw new ApiError(403, "errors.adminOnly");
  return user;
}

export function displayNameOf(user: { displayName: string | null; username: string }): string {
  return user.displayName?.trim() || user.username;
}
