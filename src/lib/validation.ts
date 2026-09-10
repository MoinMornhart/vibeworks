import { z } from "zod";
import { PROJECT_ACCENTS } from "./status";
import { normalizeTags } from "./utils";

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

// ── Projekte ────────────────────────────────────────────────

export const projectStatusSchema = z.enum(["IDEA", "PLANNING", "OPEN", "IN_PROGRESS", "DONE", "ARCHIVED"]);
const accentSchema = z.enum(Object.keys(PROJECT_ACCENTS) as [string, ...string[]]);
const tagsSchema = z.union([z.array(z.string().max(64)).max(50), z.string().max(1000)]).transform((t) => normalizeTags(t));
const optionalText = (max: number) =>
  z
    .string()
    .max(max)
    .nullish()
    .transform((v) => (v?.trim() ? v : null));

const repoUrlSchema = z
  .string()
  .trim()
  .max(500)
  .nullish()
  .transform((v) => v || null)
  .refine((v) => v === null || /^(https?:\/\/|git@)[^\s]+$/.test(v), "Bitte eine Repository-Adresse (https://… oder git@…)");

export const projectCreateSchema = z.object({
  name: z.string().trim().min(1, "Name fehlt").max(120, "Name: höchstens 120 Zeichen"),
  summary: optionalText(240),
  description: optionalText(20_000),
  status: projectStatusSchema.default("IDEA"),
  priority: z.number().int().min(1).max(4).default(2),
  progress: z.number().int().min(0).max(100).default(0),
  accent: accentSchema.default("violet"),
  tags: tagsSchema.default([]),
  favorite: z.boolean().default(false),
  progressFromTasks: z.boolean().default(false),
  repoUrl: repoUrlSchema,
});

export const projectUpdateSchema = projectCreateSchema.partial();

export const projectReorderSchema = z.object({
  status: projectStatusSchema,
  ids: z.array(z.string().max(40)).max(1000),
});

export const projectBulkSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("status"), ids: z.array(z.string().max(40)).min(1).max(500), status: projectStatusSchema }),
  z.object({ action: z.literal("addTags"), ids: z.array(z.string().max(40)).min(1).max(500), tags: tagsSchema }),
  z.object({ action: z.literal("removeTags"), ids: z.array(z.string().max(40)).min(1).max(500), tags: tagsSchema }),
  z.object({ action: z.literal("favorite"), ids: z.array(z.string().max(40)).min(1).max(500), favorite: z.boolean() }),
  z.object({ action: z.literal("delete"), ids: z.array(z.string().max(40)).min(1).max(500) }),
]);

// ── Notizen ─────────────────────────────────────────────────

export const noteCreateSchema = z.object({
  title: optionalText(200),
  content: z.string().max(50_000, "Notiz: höchstens 50 000 Zeichen").refine((v) => v.trim().length > 0, "Die Notiz ist leer"),
  pinned: z.boolean().default(false),
});

export const noteUpdateSchema = z.object({
  // .optional() außen: ein fehlender Titel bleibt undefined („nicht ändern“)
  // und wird nicht zu null („Titel löschen“).
  title: optionalText(200).optional(),
  content: z.string().max(50_000).refine((v) => v.trim().length > 0, "Die Notiz ist leer").optional(),
  pinned: z.boolean().optional(),
});

/** Nur relative Pfade innerhalb der App als Weiterleitungsziel. */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next;
}
