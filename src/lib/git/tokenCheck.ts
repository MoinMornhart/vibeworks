import { db } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { tk, translateMessage } from "@/lib/i18n/messages";
import { appLink, notifyUser } from "@/lib/notify";
import type { GitProvider } from "./parse";
import { GitTokenError, probeToken } from "./token";
import { evaluateScopes, problemKey } from "./tokenCheckLogic";

// Git-Zugänge einmal am Tag prüfen (#98): gilt der Token, hat er die nötigen
// Rechte? Ändert sich das Problem, gibt es genau eine Benachrichtigung.

const DAY_MS = 24 * 60 * 60_000;

export async function checkCredential(id: string): Promise<void> {
  const cred = await db.gitCredential.findUnique({ where: { id } });
  if (!cred || cred.provider === "git") return;
  let error: string | null = null;
  let scopes: string[] | null = null;
  let token = "";
  try {
    token = decrypt(cred.cipher);
    ({ scopes } = await probeToken(cred.provider as GitProvider, cred.baseUrl, token));
  } catch (err) {
    // Nur echte Absagen zählen – ein nicht erreichbarer Server ist kein ungültiger Token
    if (err instanceof GitTokenError && err.status === 502) {
      await db.gitCredential.update({ where: { id }, data: { checkedAt: new Date() } });
      return;
    }
    error = err instanceof Error ? err.message : tk("git", "errors.decrypt");
  }
  const report = error ? null : evaluateScopes(cred.provider, token, scopes);
  const key = problemKey(error, report);
  await db.gitCredential.update({
    where: { id },
    data: {
      checkedAt: new Date(),
      checkError: error,
      ...(report ? { scopes: scopes ?? [], scopeKind: report.kind } : {}),
      checkNotified: key,
    },
  });
  if (key && key !== cred.checkNotified) {
    await notifyUser(cred.userId, "gitFailed", (t, locale) => ({
      event: "gitFailed",
      title: t("events.tokenProblem.title", { host: cred.host }),
      message: error ? t("events.tokenProblem.invalid", { error: translateMessage(locale, error) }) : t("events.tokenProblem.missing", { list: report!.missing.join(", ") }),
      url: appLink("/account#git-zugang"),
      priority: "high",
    })).catch((e) => console.error("[git-check] Meldung:", e));
  }
}

/** Fällige Prüfungen – aus dem Git-Takt, höchstens einmal am Tag je Zugang. */
export async function runCredentialChecks(now = Date.now()): Promise<void> {
  const due = await db.gitCredential.findMany({
    where: { provider: { not: "git" }, OR: [{ checkedAt: null }, { checkedAt: { lt: new Date(now - DAY_MS) } }] },
    select: { id: true },
    take: 50,
  });
  for (const c of due) await checkCredential(c.id);
}
