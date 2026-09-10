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

export const repoAccessSchema = z.object({
  // null entfernt das Token, undefined lässt es stehen
  token: z
    .string()
    .trim()
    .min(8, "Das Token ist zu kurz")
    .max(500, "Das Token ist zu lang")
    .regex(/^[\x21-\x7e]+$/, "Das Token enthält ungültige Zeichen")
    .nullable()
    .optional(),
  issueSync: z.boolean().optional(),
});

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

// ── Aufgaben ────────────────────────────────────────────────

export const taskStatusSchema = z.enum(["TODO", "DOING", "BLOCKED", "DONE"]);
export const recurrenceSchema = z.enum(["DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY"]);

const dueDateSchema = z
  .union([
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Datum als JJJJ-MM-TT")
      .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), "Ungültiges Datum"),
    z.literal(""),
  ])
  .nullish()
  .transform((v) => v || null);

const labelsSchema = z.union([z.array(z.string().max(40)).max(30), z.string().max(500)]).transform((t) => normalizeTags(t, 8));

export const taskCreateSchema = z.object({
  title: z.string().trim().min(1, "Titel fehlt").max(200, "Titel: höchstens 200 Zeichen"),
  description: optionalText(20_000),
  status: taskStatusSchema.default("TODO"),
  dueDate: dueDateSchema,
  labels: labelsSchema.default([]),
  recurrence: recurrenceSchema.nullish().transform((v) => v ?? null),
});

// Alles außen .optional(): Fehlendes heißt „nicht ändern“, nicht „leeren“.
export const taskUpdateSchema = z.object({
  title: z.string().trim().min(1, "Titel fehlt").max(200).optional(),
  description: optionalText(20_000).optional(),
  status: taskStatusSchema.optional(),
  dueDate: dueDateSchema.optional(),
  labels: labelsSchema.optional(),
  recurrence: recurrenceSchema.nullable().optional(),
});

export const taskReorderSchema = z.object({
  status: taskStatusSchema,
  ids: z.array(z.string().max(40)).max(2000),
});

// ── Mein Konto ──────────────────────────────────────────────

export const profileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .max(60, "Anzeigename: höchstens 60 Zeichen")
    .nullish()
    .transform((v) => v || null)
    .optional(),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(200)
    .nullish()
    .transform((v) => v || null)
    .refine((v) => v === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Bitte eine gültige E-Mail-Adresse")
    .optional(),
});

export const passwordChangeSchema = z.object({
  currentPassword: z.string().max(256).optional(),
  newPassword: z.string().min(1, "Neues Passwort fehlt").max(256),
});

// ── Zwei-Faktor ─────────────────────────────────────────────

export const totpCodeSchema = z.object({ code: z.string().trim().min(1, "Code fehlt").max(20) });

export const confirmIdentitySchema = z.object({
  password: z.string().max(256).optional(),
  code: z.string().trim().max(20).optional(),
});

export const mfaLoginSchema = z
  .object({
    code: z.string().trim().max(20).optional(),
    recoveryCode: z.string().trim().max(40).optional(),
  })
  .refine((v) => v.code || v.recoveryCode, "Code fehlt");

// ── Passkeys ────────────────────────────────────────────────

// Die eigentliche Prüfung übernimmt SimpleWebAuthn; hier nur Form und Größe.
const webauthnResponseSchema = z
  .object({
    id: z.string().min(1).max(1024),
    rawId: z.string().max(1024),
    type: z.literal("public-key"),
    response: z.record(z.unknown()),
    clientExtensionResults: z.record(z.unknown()).default({}),
    authenticatorAttachment: z.string().max(40).optional(),
  })
  .passthrough();

export const passkeyRegisterSchema = z.object({
  response: webauthnResponseSchema,
  name: z.string().trim().max(60).optional(),
});

export const passkeyLoginSchema = z.object({ response: webauthnResponseSchema });

export const passkeyRenameSchema = z.object({ name: z.string().trim().min(1, "Name fehlt").max(60, "Höchstens 60 Zeichen") });

// ── Administration ──────────────────────────────────────────

export const adminSettingsSchema = z.object({
  mode: z.enum(["SINGLE", "MULTI"]).optional(),
  allowRegistration: z.boolean().optional(),
  taskColumnLimit: z.number().int().min(0, "Mindestens 0").max(500, "Höchstens 500").optional(),
});

export const adminUserCreateSchema = z.object({
  username: usernameSchema,
  displayName,
  password,
  role: z.enum(["ADMIN", "USER"]).default("USER"),
});

export const adminUserUpdateSchema = z.object({
  displayName: z
    .string()
    .trim()
    .max(60)
    .nullish()
    .transform((v) => v || null)
    .optional(),
  role: z.enum(["ADMIN", "USER"]).optional(),
  active: z.boolean().optional(),
  password: z.string().max(256).optional(),
  unlock: z.boolean().optional(),
});

// ── Mini-Docs ───────────────────────────────────────────────

export const docCreateSchema = z.object({
  title: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => v || "Neue Seite"),
  parentId: z
    .string()
    .max(40)
    .nullish()
    .transform((v) => v || null),
});

// Außen .optional(): Fehlendes heißt „nicht ändern“.
export const docUpdateSchema = z.object({
  title: z.string().trim().min(1, "Titel fehlt").max(200, "Titel: höchstens 200 Zeichen").optional(),
  icon: z
    .string()
    .trim()
    .max(16)
    .nullish()
    .transform((v) => v || null)
    .optional(),
  content: z.string().max(1_000_000, "Höchstens eine Million Zeichen").optional(),
  parentId: z.string().max(40).nullable().optional(),
  move: z.enum(["up", "down"]).optional(),
  pinned: z.boolean().optional(),
});

/** Nur relative Pfade innerhalb der App als Weiterleitungsziel. */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next;
}
