import { after } from "next/server";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { ApiError, json, notFound, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { encrypt } from "@/lib/crypto";
import { credentialList, GitTokenError, whoAmI } from "@/lib/git/token";
import { tokenHint, type GitProvider } from "@/lib/git/parse";
import { importFromCredential } from "@/lib/git/importRepos";
import { tk } from "@/lib/i18n/messages";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";

type Params = { id: string };

const updateSchema = z.object({
  autoImport: z.boolean().optional(),
  /** Bot-Konto nur für Issues: Token setzen (wird beim Anbieter geprüft) oder mit null entfernen */
  botToken: z.string().trim().min(8).max(500).nullable().optional(),
});

/**
 * Automatischen Import ein- oder ausschalten (eingeschaltet läuft er gleich
 * einmal) und das Bot-Konto für Issues setzen oder entfernen. Der Bot-Token
 * geht nur an den Server dieser Verbindung.
 */
export const PATCH = route<Params>(async (req, { params }) => {
  const user = await requireApiUser();
  const input = await readBody(req, updateSchema, { maxBytes: 2048 });
  const id = (await params).id;
  const cred = await db.gitCredential.findFirst({ where: { id, userId: user.id } });
  if (!cred) throw notFound(tk("account", "errors.connectionNotFound"));

  const data: Prisma.GitCredentialUpdateInput = {};
  if (input.autoImport !== undefined) data.autoImport = input.autoImport;
  if (input.botToken === null) Object.assign(data, { botCipher: null, botHint: null, botLogin: null, botAppId: null, botAppSlug: null, botAppKeyCipher: null });
  else if (input.botToken) {
    if (cred.provider === "git") throw new ApiError(400, tk("account", "git.botNoIssues"), { botToken: tk("account", "git.botNoIssues") });
    limitOrThrow(`git-bot:${user.id}`, 10, 10 * MINUTE);
    let login: string | null;
    try {
      login = await whoAmI(cred.provider as GitProvider, cred.baseUrl, input.botToken);
    } catch (err) {
      if (err instanceof GitTokenError) throw new ApiError(err.status, err.message, { botToken: err.message });
      throw err;
    }
    // Der Bot soll gerade nicht das eigene Profil sein
    if (login && cred.login && login.toLowerCase() === cred.login.toLowerCase()) {
      throw new ApiError(400, tk("account", "git.botSameAccount"), { botToken: tk("account", "git.botSameAccount") });
    }
    // Ein Bot-Token ersetzt eine früher erstellte Bot-App
    Object.assign(data, { botCipher: encrypt(input.botToken), botHint: tokenHint(input.botToken), botLogin: login, botAppId: null, botAppSlug: null, botAppKeyCipher: null });
  }

  await db.gitCredential.update({ where: { id }, data });
  if (input.autoImport) after(() => importFromCredential(id));
  return json({ connections: await credentialList(user.id) });
});

export const DELETE = route<Params>(async (_req, { params }) => {
  const user = await requireApiUser();
  const { count } = await db.gitCredential.deleteMany({ where: { id: (await params).id, userId: user.id } });
  if (!count) throw notFound(tk("account", "errors.connectionNotFound"));
  return json({ connections: await credentialList(user.id) });
});
