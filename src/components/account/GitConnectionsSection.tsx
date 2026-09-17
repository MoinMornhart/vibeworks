"use client";

import { useEffect, useState } from "react";
import {
  Bot,
  CheckCircle2,
  ExternalLink,
  GitBranch,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import { FormError } from "@/components/ui/FormError";
import {
  EMPTY_GIT_CONNECTION,
  GitProviderFields,
  type GitConnectionForm,
} from "@/components/git/GitProviderFields";
import { PROVIDER_LABEL, type GitProvider } from "@/lib/git/parse";
import { api, ApiClientError, errorMessage } from "@/lib/client/api";
import { useFormat, useMsg, useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { AccountSection } from "./AccountManager";
import { confirmDialog } from "@/lib/client/dialogs";

export interface GitConnectionItem {
  id: string;
  provider: GitProvider;
  host: string;
  baseUrl: string;
  hint: string;
  login: string | null;
  botHint: string | null;
  botLogin: string | null;
  botApp: { slug: string; installUrl: string; settingsUrl: string } | null;
  botAppPossible: boolean;
  autoImport: boolean;
  check: { at: string | null; error: string | null; kind: string | null; scopes: string[]; missing: string[]; optionalMissing: Array<{ scope: string; feature: "workflow" | "webhook" }> };
  importedAt: string | null;
  importError: string | null;
  importCount: number;
}

type ListResponse = { connections: GitConnectionItem[] };

export function GitConnectionsSection({
  initial,
}: {
  initial: GitConnectionItem[];
}) {
  const t = useT("account");
  const tc = useT("common");
  const f = useFormat();
  const msg = useMsg();
  const [list, setList] = useState(initial);
  const [adding, setAdding] = useState(initial.length === 0);
  const [form, setForm] = useState<GitConnectionForm>(EMPTY_GIT_CONNECTION);
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState<string | undefined>();
  const [botInput, setBotInput] = useState<Record<string, string>>({});
  const [botErrors, setBotErrors] = useState<Record<string, string>>({});
  const [botReturn, setBotReturn] = useState<
    "ready" | "expired" | "failed" | null
  >(null);

  // Rückkehr von GitHub nach „Bot per Klick“ (?bot=ready|expired|failed)
  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("bot");
    if (value === "ready" || value === "expired" || value === "failed")
      setBotReturn(value);
  }, []);

  /** Bot per Klick: App-Beschreibung holen und als Formular an GitHub schicken – GitHub legt die App an. */
  async function startBotApp(c: GitConnectionItem) {
    setBusyId(c.id);
    setBotErrors((s) => ({ ...s, [c.id]: "" }));
    try {
      const res = await api<{ action: string; manifest: string }>(
        `/api/account/git-credentials/${c.id}/bot-app`,
        { body: {} },
      );
      const formEl = document.createElement("form");
      formEl.method = "post";
      formEl.action = res.action;
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = "manifest";
      input.value = res.manifest;
      formEl.appendChild(input);
      document.body.appendChild(formEl);
      formEl.submit();
    } catch (err) {
      setBotErrors((s) => ({ ...s, [c.id]: errorMessage(err) }));
      setBusyId(null);
    }
  }

  /** Bot-Konto für Issues setzen (Token wird beim Anbieter geprüft) oder mit null entfernen. */
  async function setBot(c: GitConnectionItem, botToken: string | null) {
    setBusyId(c.id);
    setBotErrors((s) => ({ ...s, [c.id]: "" }));
    try {
      const res = await api<ListResponse>(
        `/api/account/git-credentials/${c.id}`,
        {
          method: "PATCH",
          body: { botToken: botToken === null ? null : botToken.trim() },
        },
      );
      setList(res.connections);
      setBotInput((s) => ({ ...s, [c.id]: "" }));
    } catch (err) {
      const field =
        err instanceof ApiClientError ? err.fieldErrors.botToken : undefined;
      setBotErrors((s) => ({ ...s, [c.id]: field ?? errorMessage(err) }));
    } finally {
      setBusyId(null);
    }
  }

  async function importNow(c: Pick<GitConnectionItem, "id">) {
    setBusyId(c.id);
    setNotes((n) => ({ ...n, [c.id]: "" }));
    try {
      const res = await api<
        ListResponse & { result: { created: number; error: string | null } }
      >(`/api/account/git-credentials/${c.id}/import`, { body: {} });
      setList(res.connections);
      if (!res.result.error)
        setNotes((n) => ({
          ...n,
          [c.id]: res.result.created
            ? t("git.importDone", { n: res.result.created })
            : t("git.importNothing"),
        }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.token.trim()) return;
    setBusy(true);
    setError(null);
    setTokenError(undefined);
    try {
      const res = await api<ListResponse>("/api/account/git-credentials", {
        body: {
          provider: form.provider,
          server: form.server,
          token: form.token.trim(),
        },
      });
      setList(res.connections);
      setForm(EMPTY_GIT_CONNECTION);
      setAdding(false);
      // Gleich importieren und das Ergebnis zeigen (der Server hat schon angefangen – derselbe Lauf)
      const fresh = res.connections.find(
        (c) => c.autoImport && c.provider !== "git" && !c.importedAt,
      );
      if (fresh) void importNow(fresh);
    } catch (err) {
      const field =
        err instanceof ApiClientError ? err.fieldErrors.token : undefined;
      if (field) setTokenError(field);
      else setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  /** Token jetzt auf Gültigkeit und Rechte prüfen (#98). */
  async function checkNow(c: GitConnectionItem) {
    setBusyId(c.id);
    setError(null);
    try {
      const res = await api<ListResponse>(`/api/account/git-credentials/${c.id}`, { method: "PATCH", body: { check: true } });
      setList(res.connections);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  async function toggle(c: GitConnectionItem, autoImport: boolean) {
    setBusyId(c.id);
    setError(null);
    try {
      const res = await api<ListResponse>(
        `/api/account/git-credentials/${c.id}`,
        { method: "PATCH", body: { autoImport } },
      );
      setList(res.connections);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  async function remove(c: GitConnectionItem) {
    if (!(await confirmDialog(t("git.confirmRemove", { host: c.host }), { danger: true }))) return;
    setError(null);
    try {
      const res = await api<ListResponse>(
        `/api/account/git-credentials/${c.id}`,
        { method: "DELETE" },
      );
      setList(res.connections);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div id="git-zugang" className="scroll-mt-24">
      <AccountSection
        icon={<GitBranch size={18} />}
        title={t("git.title")}
        description={t("git.description")}
      >
        {botReturn && (
          <p
            role="status"
            className={cn(
              "mb-3 rounded-xl border px-3 py-2 text-sm",
              botReturn === "ready"
                ? "border-emerald-500/40 bg-emerald-500/10"
                : "border-red-500/40 bg-red-500/10",
            )}
            data-testid="git-bot-return"
          >
            {t(`git.botAppReturn.${botReturn}`)}
          </p>
        )}
        {list.length > 0 && (
          <ul className="mb-4 space-y-2">
            {list.map((c) => (
              <li
                key={c.id}
                data-testid="git-connection"
                className={cn(
                  "rounded-2xl border px-4 py-3",
                  c.importError
                    ? "border-red-500/40 bg-red-500/10"
                    : "border-emerald-500/40 bg-emerald-500/10",
                )}
              >
                <div className="flex flex-wrap items-center gap-3">
                  {c.importError ? (
                    <TriangleAlert
                      size={20}
                      className="shrink-0 text-red-400"
                    />
                  ) : (
                    <CheckCircle2
                      size={20}
                      className="shrink-0 text-emerald-400"
                    />
                  )}
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="font-medium">
                      {PROVIDER_LABEL[c.provider]} · {c.host}
                      {c.login && (
                        <>
                          {" "}
                          {t("git.as")}{" "}
                          <span className="text-accent-ink">@{c.login}</span>
                        </>
                      )}
                    </p>
                    <p className="font-mono text-xs text-muted">{c.hint}</p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm hover:!text-red-400"
                    onClick={() => void remove(c)}
                    aria-label={t("git.removeLabel", { host: c.host })}
                  >
                    <Trash2 size={14} /> {tc("remove")}
                  </button>
                </div>

                {c.provider === "git" ? (
                  <p className="mt-2 text-xs text-muted">
                    {t("git.noListing")}
                  </p>
                ) : (
                  <div className="mt-3 space-y-2 border-t border-fg/10 pt-3 text-sm">
                    <label className="flex cursor-pointer items-start gap-2">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 accent-[var(--vw-accent)]"
                        checked={c.autoImport}
                        disabled={busyId === c.id}
                        onChange={(e) => void toggle(c, e.target.checked)}
                      />
                      <span>
                        <span className="font-medium">
                          {t("git.autoImport")}
                        </span>
                        <span className="block text-xs text-muted">
                          {t("git.autoImportHint")}
                        </span>
                      </span>
                    </label>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
                      <span suppressHydrationWarning>
                        {c.importedAt
                          ? t("git.importState", {
                              n: c.importCount,
                              ago: f.ago(c.importedAt),
                            })
                          : t("git.importNever")}
                      </span>
                      <button
                        type="button"
                        className="btn btn-sm"
                        disabled={busyId === c.id}
                        onClick={() => void importNow(c)}
                      >
                        <RefreshCw
                          size={13}
                          className={cn(busyId === c.id && "animate-spin")}
                        />{" "}
                        {busyId === c.id
                          ? t("git.importing")
                          : t("git.importNow")}
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs" data-testid="git-rights">
                      {c.check.error ? (
                        <span className="text-red-400">{t("git.rights.invalid", { error: msg(c.check.error) })}</span>
                      ) : c.check.missing.length ? (
                        <span className="text-red-400">{t("git.rights.missing", { list: c.check.missing.join(", ") })}</span>
                      ) : c.check.kind === "classic" || c.check.kind === "gitlab" ? (
                        <span className="text-emerald-400">{t("git.rights.ok", { list: c.check.scopes.join(", ") || "–" })}</span>
                      ) : c.check.kind === "fine-grained" ? (
                        <span className="text-muted">{t("git.rights.fineGrained")}</span>
                      ) : (
                        <span className="text-muted">{t("git.rights.unknown")}</span>
                      )}
                      {!c.check.error && c.check.optionalMissing.length > 0 && (
                        <span className="text-amber-300">
                          {t("git.rights.optional", { list: c.check.optionalMissing.map((o) => `${o.scope} (${t(`git.rights.feature.${o.feature}`)})`).join(", ") })}
                        </span>
                      )}
                      <span className="text-muted" suppressHydrationWarning>
                        {c.check.at ? t("git.rights.checkedAt", { ago: f.ago(c.check.at) }) : t("git.rights.never")}
                      </span>
                      <button type="button" className="btn btn-sm !py-0" disabled={busyId === c.id} onClick={() => void checkNow(c)} data-testid="git-rights-check">
                        {t("git.rights.checkNow")}
                      </button>
                    </div>
                    {c.importError && (
                      <p role="alert" className="text-xs text-red-400">
                        {t("git.importError", { error: msg(c.importError) })}
                      </p>
                    )}
                    {notes[c.id] && (
                      <p role="status" className="text-xs text-emerald-400">
                        {notes[c.id]}
                      </p>
                    )}
                    <div
                      className="border-t border-fg/10 pt-3"
                      data-testid="git-bot"
                    >
                      <p className="flex items-center gap-1.5 font-medium">
                        <Bot size={14} className="text-accent-ink" />{" "}
                        {t("git.botTitle")}
                      </p>
                      {c.botHint ? (
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                          <span className="text-emerald-400">
                            {c.botLogin
                              ? t("git.botAs", { login: c.botLogin })
                              : c.botHint}
                          </span>
                          {c.botApp && (
                            <>
                              <a
                                className="btn btn-sm"
                                href={c.botApp.installUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                data-testid="git-bot-install"
                              >
                                <ExternalLink size={13} />{" "}
                                {t("git.botAppInstall")}
                              </a>
                              <a
                                className="btn btn-sm"
                                href={c.botApp.settingsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {t("git.botAppManage")}
                              </a>
                            </>
                          )}
                          <button
                            type="button"
                            className="btn btn-sm"
                            disabled={busyId === c.id}
                            onClick={async () => {
                              if (
                                c.botApp &&
                                !(await confirmDialog(t("git.botAppConfirmRemove"), { danger: true }))
                              )
                                return;
                              void setBot(c, null);
                            }}
                          >
                            {t("git.botRemove")}
                          </button>
                        </div>
                      ) : (
                        <>
                          {c.botAppPossible && (
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                disabled={busyId === c.id}
                                onClick={() => void startBotApp(c)}
                                data-testid="git-bot-app"
                              >
                                <Sparkles size={13} /> {t("git.botAppCreate")}
                              </button>
                              <span className="text-xs text-muted">
                                {t("git.botAppHint")}
                              </span>
                            </div>
                          )}
                          <details className="mt-2" open={!c.botAppPossible}>
                            {c.botAppPossible && (
                              <summary className="cursor-pointer text-xs text-muted">
                                {t("git.botTokenInstead")}
                              </summary>
                            )}
                            <form
                              className="mt-1 flex flex-wrap gap-2"
                              onSubmit={(e) => {
                                e.preventDefault();
                                void setBot(c, botInput[c.id] ?? "");
                              }}
                            >
                              <input
                                type="password"
                                autoComplete="off"
                                spellCheck={false}
                                className="field min-w-0 flex-1 font-mono text-xs"
                                placeholder={t("git.botPlaceholder")}
                                aria-label={t("git.botTitle")}
                                maxLength={500}
                                value={botInput[c.id] ?? ""}
                                onChange={(e) =>
                                  setBotInput((s) => ({
                                    ...s,
                                    [c.id]: e.target.value,
                                  }))
                                }
                              />
                              <button
                                className="btn btn-sm"
                                disabled={
                                  busyId === c.id ||
                                  !(botInput[c.id] ?? "").trim()
                                }
                              >
                                {t("git.botSave")}
                              </button>
                            </form>
                            <p className="mt-1 text-xs text-muted">
                              {t("git.botHint")}
                            </p>
                          </details>
                        </>
                      )}
                      {botErrors[c.id] && (
                        <p role="alert" className="mt-1 text-xs text-red-400">
                          {botErrors[c.id]}
                        </p>
                      )}
                      <details className="mt-2 text-xs" data-testid="git-bot-how">
                        <summary className="cursor-pointer text-muted">{t("git.botHow.title")}</summary>
                        <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted">
                          <li>{t("git.botHow.issues")}</li>
                          <li>{t("git.botHow.commands")}</li>
                          <li>{t("git.botHow.rights")}</li>
                          <li>{t("git.botHow.conversation")}</li>
                          <li>{t("git.botHow.timing")}</li>
                        </ul>
                      </details>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {adding ? (
          <form
            onSubmit={save}
            className="space-y-3 rounded-2xl border bg-bg/30 p-4"
          >
            <GitProviderFields
              value={form}
              onChange={(v) => {
                setForm(v);
                setTokenError(undefined); // alte Meldung passt nach einer Änderung nicht mehr
              }}
              error={tokenError}
              idPrefix="account-git"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={busy || !form.token.trim()}
              >
                <Save size={14} /> {busy ? t("git.checking") : t("git.connect")}
              </button>
              {list.length > 0 && (
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => setAdding(false)}
                >
                  <X size={14} /> {tc("cancel")}
                </button>
              )}
            </div>
            <p className="text-xs text-muted">
              {form.provider === "git"
                ? t("git.tokenHintGit")
                : t("git.tokenHint")}
            </p>
          </form>
        ) : (
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setAdding(true)}
          >
            <Plus size={14} /> {t("git.add")}
          </button>
        )}
        <FormError message={error} />
      </AccountSection>
    </div>
  );
}
