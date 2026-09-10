import { z } from "zod";

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Benutzername: mindestens 3 Zeichen")
  .max(32, "Benutzername: höchstens 32 Zeichen")
  .regex(/^[a-z0-9._-]+$/, "Benutzername: nur a–z, 0–9, Punkt, Binde- und Unterstrich");

const password = z.string().min(1, "Passwort fehlt").max(256);
const displayName = z.string().trim().max(60).optional().transform((v) => v || undefined);

export const loginSchema = z.object({
  username: z.string().trim().toLowerCase().min(1, "Benutzername fehlt").max(64),
  password,
});

export const setupSchema = z.object({
  username: usernameSchema,
  displayName,
  password,
  mode: z.enum(["SINGLE", "MULTI"]),
  allowRegistration: z.boolean().default(false),
});

export const registerSchema = z.object({
  username: usernameSchema,
  displayName,
  password,
});

/** Nur relative Pfade innerhalb der App als Weiterleitungsziel. */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next;
}
