import { z } from "zod";
import { PROJECT_ACCENTS } from "./status";
import { normalizeTags } from "./utils";
import { tk } from "./i18n/messages";
import { CAUSES } from "./grave";

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, tk("validation", "username.min"))
  .max(32, tk("validation", "username.max"))
  .regex(/^[a-z0-9._-]+$/, tk("validation", "username.chars"));

const password = z.string().min(1, tk("validation", "passwordMissing")).max(256);
const displayName = z.string().trim().max(60).optional().transform((v) => v || undefined);

export const loginSchema = z.object({
  username: z.string().trim().toLowerCase().min(1, tk("validation", "username.missing")).max(64),
  password,
});

export const gitProviderSchema = z.enum(["github", "gitlab", "gitea"]);

// Optionale Git-Verbindung beim Anlegen eines Kontos – leeres Token heißt „keine“.
const optionalGitConnection = {
  gitToken: z
    .string()
    .trim()
    .max(500, tk("validation", "token.tooLong"))
    .regex(/^[\x21-\x7e]*$/, tk("validation", "token.invalidChars"))
    .optional()
    .transform((v) => v || null),
  gitProvider: gitProviderSchema.default("github"),
  gitServer: z.string().trim().max(300).default(""),
};

export const setupSchema = z.object({
  username: usernameSchema,
  displayName,
  password,
  ...optionalGitConnection,
  mode: z.enum(["SINGLE", "MULTI"]),
  allowRegistration: z.boolean().default(false),
});

export const registerSchema = z.object({
  username: usernameSchema,
  displayName,
  password,
  ...optionalGitConnection,
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
  .refine((v) => v === null || /^(https?:\/\/|git@)[^\s]+$/.test(v), tk("validation", "repoUrl"));

const liveUrlSchema = z
  .string()
  .trim()
  .max(500)
  .nullish()
  .transform((v) => v || null)
  .refine((v) => v === null || /^https?:\/\/[^\s/]+[^\s]*$/.test(v), tk("validation", "liveUrl"));

export const projectCreateSchema = z.object({
  name: z.string().trim().min(1, tk("validation", "nameMissing")).max(120, tk("validation", "nameMax120")),
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
  liveUrl: liveUrlSchema,
});

export const projectUpdateSchema = projectCreateSchema.partial();

// ── Prompts ─────────────────────────────────────────────────

export const promptSchema = z.object({
  title: z.string().trim().min(1, tk("validation", "titleMissing")).max(120),
  body: z.string().max(20_000).refine((v) => v.trim().length > 0, tk("prompts", "errors.bodyEmpty")),
  tags: tagsSchema.default([]),
  projectId: z.string().max(40).nullish().transform((v) => v || null),
});

export const promptUpdateSchema = promptSchema.partial();

// ── Heute ───────────────────────────────────────────────────

export const todayFocusSchema = z.object({ taskId: z.string().min(1).max(40) });

// ── Projekt-Friedhof ────────────────────────────────────────

export const graveActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("bury"),
    cause: z.enum(CAUSES).nullish(),
    epitaph: z.string().trim().max(200).nullish(),
  }),
  z.object({ action: z.literal("resurrect") }),
  z.object({ action: z.literal("snooze") }),
  z.object({ action: z.literal("continue") }),
]);

// ── API-Schlüssel ───────────────────────────────────────────

export const apiTokenCreateSchema = z.object({
  name: z.string().trim().min(1, tk("mcp", "errors.nameMissing")).max(60),
});

// ── Benachrichtigungen ──────────────────────────────────────

const optionalText254 = z.string().trim().max(254).nullish().transform((v) => v || null);

export const notificationSettingsSchema = z.object({
  ntfyUrl: z
    .string()
    .trim()
    .max(500)
    .nullish()
    .transform((v) => v || null)
    .refine((v) => v === null || /^https?:\/\/[^/\s]+\/[\w-]{1,64}\/?$/.test(v), tk("notify", "errors.badNtfyUrl")),
  // undefined = behalten, null = entfernen
  ntfyToken: z.string().trim().max(300).nullable().optional(),
  webhookUrl: z
    .string()
    .trim()
    .max(1000)
    .nullish()
    .transform((v) => v || null)
    .refine((v) => v === null || /^https?:\/\/\S+$/.test(v), tk("notify", "errors.badWebhookUrl")),
  email: optionalText254.refine((v) => v === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), tk("notify", "errors.badEmail")),
  events: z.record(z.boolean()).default({}),
});

export const smtpSettingsSchema = z.object({
  host: z.string().trim().max(253).nullish().transform((v) => v || null),
  port: z.number().int().min(1).max(65535).nullish(),
  secure: z.boolean().default(false),
  user: optionalText254,
  // undefined = behalten, null = entfernen
  password: z.string().max(500).nullable().optional(),
  from: optionalText254,
});

export const smtpTestSchema = z.object({ to: z.string().trim().max(254).regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, tk("notify", "errors.badEmail")) });

// Anlegen mit Vorlage: "builtin:web" oder die ID einer eigenen Vorlage
export const projectCreateWithTemplateSchema = projectCreateSchema.extend({ templateId: z.string().max(60).optional() });

export const templateCreateSchema = z.object({
  projectId: z.string().max(40),
  name: z.string().trim().min(1, tk("validation", "nameMissing")).max(80),
  description: z.string().trim().max(300).nullish(),
});

export const repoAccessSchema = z.object({
  // null entfernt das Token, undefined lässt es stehen
  token: z
    .string()
    .trim()
    .min(8, tk("validation", "token.tooShort"))
    .max(500, tk("validation", "token.tooLong"))
    .regex(/^[\x21-\x7e]+$/, tk("validation", "token.invalidChars"))
    .nullable()
    .optional(),
  issueSync: z.boolean().optional(),
  // Webhook: einrichten, Geheimnis erneuern, entfernen oder beim Anbieter eintragen
  webhook: z.enum(["on", "renew", "off", "install"]).optional(),
});

export const gitCredentialSchema = z.object({
  provider: gitProviderSchema,
  // Leer = Standardserver des Anbieters (github.com, gitlab.com)
  server: z.string().trim().max(300, tk("validation", "serverTooLong")).default(""),
  token: z
    .string()
    .trim()
    .min(8, tk("validation", "token.tooShort"))
    .max(500, tk("validation", "token.tooLong"))
    .regex(/^[\x21-\x7e]+$/, tk("validation", "token.invalidChars")),
});

// ── Teilen ──────────────────────────────────────────────────

export const projectRoleSchema = z.enum(["VIEWER", "EDITOR"]);

export const shareLinkSchema = z.object({ link: z.enum(["on", "off", "renew"]) });

export const memberAddSchema = z.object({
  username: z.string().trim().toLowerCase().min(1, tk("validation", "username.missing")).max(64),
  role: projectRoleSchema.default("VIEWER"),
});

export const memberUpdateSchema = z.object({ role: projectRoleSchema });

export const accessRequestSchema = z.object({
  role: projectRoleSchema.default("VIEWER"),
  message: optionalText(500),
});

export const accessDecisionSchema = z.object({
  decision: z.enum(["approve", "deny"]),
  role: projectRoleSchema.optional(),
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
  content: z.string().max(50_000, tk("validation", "note.tooLong")).refine((v) => v.trim().length > 0, tk("validation", "note.empty")),
  pinned: z.boolean().default(false),
});

export const noteUpdateSchema = z.object({
  // .optional() außen: ein fehlender Titel bleibt undefined („nicht ändern“)
  // und wird nicht zu null („Titel löschen“).
  title: optionalText(200).optional(),
  content: z.string().max(50_000).refine((v) => v.trim().length > 0, tk("validation", "note.empty")).optional(),
  pinned: z.boolean().optional(),
});

// ── Aufgaben ────────────────────────────────────────────────

export const taskStatusSchema = z.enum(["TODO", "DOING", "BLOCKED", "DONE"]);
export const recurrenceSchema = z.enum(["DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY"]);

const dueDateSchema = z
  .union([
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, tk("validation", "date.format"))
      .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), tk("validation", "date.invalid")),
    z.literal(""),
  ])
  .nullish()
  .transform((v) => v || null);

const labelsSchema = z.union([z.array(z.string().max(40)).max(30), z.string().max(500)]).transform((t) => normalizeTags(t, 8));

export const taskCreateSchema = z.object({
  title: z.string().trim().min(1, tk("validation", "titleMissing")).max(200, tk("validation", "titleMax200")),
  description: optionalText(20_000),
  status: taskStatusSchema.default("TODO"),
  dueDate: dueDateSchema,
  labels: labelsSchema.default([]),
  recurrence: recurrenceSchema.nullish().transform((v) => v ?? null),
});

// Dieselbe Aufgabe für mehrere Projekte (Aufgabenübersicht, MCP)
export const taskBulkSchema = taskCreateSchema.pick({ title: true, description: true, dueDate: true, labels: true }).extend({
  projectIds: z.array(z.string().max(40)).min(1, tk("tasks", "overview.bulk.noProjects")).max(200),
});

// Alles außen .optional(): Fehlendes heißt „nicht ändern“, nicht „leeren“.
export const taskUpdateSchema = z.object({
  title: z.string().trim().min(1, tk("validation", "titleMissing")).max(200).optional(),
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
    .max(60, tk("validation", "displayNameMax60"))
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
    .refine((v) => v === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), tk("validation", "emailInvalid"))
    .optional(),
});

export const passwordChangeSchema = z.object({
  currentPassword: z.string().max(256).optional(),
  newPassword: z.string().min(1, tk("validation", "newPasswordMissing")).max(256),
});

// ── Zwei-Faktor ─────────────────────────────────────────────

export const totpCodeSchema = z.object({ code: z.string().trim().min(1, tk("validation", "codeMissing")).max(20) });

export const confirmIdentitySchema = z.object({
  password: z.string().max(256).optional(),
  code: z.string().trim().max(20).optional(),
});

export const mfaLoginSchema = z
  .object({
    code: z.string().trim().max(20).optional(),
    recoveryCode: z.string().trim().max(40).optional(),
  })
  .refine((v) => v.code || v.recoveryCode, tk("validation", "codeMissing"));

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

export const passkeyRenameSchema = z.object({ name: z.string().trim().min(1, tk("validation", "nameMissing")).max(60, tk("validation", "max60Chars")) });

// ── Administration ──────────────────────────────────────────

export const adminSettingsSchema = z.object({
  mode: z.enum(["SINGLE", "MULTI"]).optional(),
  allowRegistration: z.boolean().optional(),
  taskColumnLimit: z.number().int().min(0, tk("validation", "min0")).max(500, tk("validation", "max500")).optional(),
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
  title: z.string().trim().min(1, tk("validation", "titleMissing")).max(200, tk("validation", "titleMax200")).optional(),
  icon: z
    .string()
    .trim()
    .max(16)
    .nullish()
    .transform((v) => v || null)
    .optional(),
  content: z.string().max(1_000_000, tk("validation", "maxMillionChars")).optional(),
  parentId: z.string().max(40).nullable().optional(),
  move: z.enum(["up", "down"]).optional(),
  pinned: z.boolean().optional(),
});

/** Nur relative Pfade innerhalb der App als Weiterleitungsziel. */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next;
}
