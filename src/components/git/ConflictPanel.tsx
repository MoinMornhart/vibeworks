"use client";

import { useMemo, useState } from "react";
import { Check, ExternalLink, GitMerge, RefreshCw, RotateCcw, Save, TriangleAlert, Wand2 } from "lucide-react";
import { api, errorMessage } from "@/lib/client/api";
import { useMsg, useT } from "@/lib/i18n/client";
import { checkSyntax, conflictCount, formatJson, parseConflicts, resolveAll, resolveConflict, type Choice } from "@/lib/git/conflictLogic";
import type { ConflictDetails, ConflictPr } from "@/lib/git/conflicts";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/utils";
import { confirmDialog } from "@/lib/client/dialogs";

/** Merge-Konflikte (#92): Pull Requests mit Konflikten, Editor je Datei, Lösung als Merge-Commit in den PR. */
export function ConflictPanel({ projectId, canEdit }: { projectId: string; canEdit: boolean }) {
  const t = useT("git");
  const msg = useMsg();
  const [prs, setPrs] = useState<ConflictPr[] | null>(null);
  const [details, setDetails] = useState<ConflictDetails | null>(null);
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [active, setActive] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guard<T>(fn: () => Promise<T>): Promise<T | null> {
    setBusy(true);
    setError(null);
    try {
      return await fn();
    } catch (e) {
      setError(errorMessage(e));
      return null;
    } finally {
      setBusy(false);
    }
  }

  const loadList = () =>
    void guard(async () => {
      setPrs((await api<{ prs: ConflictPr[] }>(`/api/projects/${projectId}/conflicts`)).prs);
      setDetails(null);
    });

  const open = (pr: number) =>
    void guard(async () => {
      const d = (await api<{ details: ConflictDetails }>(`/api/projects/${projectId}/conflicts`, { body: { action: "load", pr } })).details;
      setDetails(d);
      setTexts(Object.fromEntries(d.files.map((f) => [f.path, f.merged])));
      setActive(d.files[0]?.path ?? null);
    });

  const file = details?.files.find((f) => f.path === active) ?? null;
  const text = active ? (texts[active] ?? "") : "";
  const setText = (v: string) => active && setTexts((s) => ({ ...s, [active]: v }));
  const segments = useMemo(() => parseConflicts(text), [text]);
  const syntax = useMemo(() => (active ? checkSyntax(active, text) : null), [active, text]);
  const states = useMemo(
    () => Object.fromEntries((details?.files ?? []).map((f) => [f.path, f.editable ? checkSyntax(f.path, texts[f.path] ?? "") : null])),
    [details, texts],
  );
  const allEditable = Boolean(details?.files.every((f) => f.editable));
  const openMarkers = details?.files.filter((f) => states[f.path]?.problem === "markers").length ?? 0;
  const warnings = details?.files.filter((f) => states[f.path] && !states[f.path]!.ok && states[f.path]!.problem !== "markers").length ?? 0;
  const canSave = canEdit && details && details.pr.sameRepo && allEditable && openMarkers === 0 && details.files.length > 0;

  async function save() {
    if (!details || !canSave) return;
    if (warnings && !(await confirmDialog(t("conflicts.confirmWarnings", { n: warnings })))) return;
    if (!(await confirmDialog(t("conflicts.confirmSave", { n: details.pr.number, branch: details.pr.headRef })))) return;
    const res = await guard(() =>
      api<{ result: { commit: string; url: string } }>(`/api/projects/${projectId}/conflicts`, {
        body: { action: "resolve", pr: details.pr.number, headSha: details.headSha, files: details.files.map((f) => ({ path: f.path, content: texts[f.path] ?? "" })) },
      }),
    );
    if (res) {
      toast(t("conflicts.saved", { sha: res.result.commit.slice(0, 7) }));
      setDetails(null);
      loadList();
    }
  }

  const choose = (index: number, choice: Choice) => setText(resolveConflict(text, index, choice));
  let conflictNo = -1;

  return (
    <section id="conflicts" className="glass scroll-mt-24 p-6 sm:p-8" aria-labelledby="conflicts-heading" data-testid="conflicts">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h2 id="conflicts-heading" className="flex items-center gap-2 text-lg font-semibold">
          <GitMerge size={18} className="text-accent-ink" /> {t("conflicts.title")}
        </h2>
        <button type="button" className={cn("btn btn-sm", !prs && "btn-primary")} onClick={loadList} disabled={busy} data-testid="conflicts-load">
          <RefreshCw size={14} className={cn(busy && "animate-spin")} /> {prs ? t("conflicts.reload") : t("conflicts.load")}
        </button>
      </div>
      <p className="mb-4 text-xs text-muted">{t("conflicts.hint")}</p>
      {error && <p role="alert" className="mb-3 text-sm text-red-400">{msg(error)}</p>}

      {prs && !details && (
        prs.length === 0 ? (
          <p className="text-sm text-emerald-400">{t("conflicts.none")}</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {prs.map((pr) => (
              <li key={pr.number} className="flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2" data-testid="conflicts-pr">
                <span className={cn("h-2 w-2 rounded-full", pr.conflicted ? "bg-red-400" : "bg-amber-300")} />
                <a href={pr.url} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline">
                  #{pr.number} {pr.title}
                </a>
                <code className="text-xs text-muted">
                  {pr.headRef} → {pr.baseRef}
                </code>
                {pr.conflicted === null && <span className="text-xs text-muted">{t("conflicts.computing")}</span>}
                <button type="button" className="btn btn-sm ml-auto" disabled={busy} onClick={() => open(pr.number)} data-testid="conflicts-open">
                  {t("conflicts.open")}
                </button>
              </li>
            ))}
          </ul>
        )
      )}

      {details && (
        <div className="space-y-4 text-sm" data-testid="conflicts-editor">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDetails(null)}>
              ← {t("conflicts.back")}
            </button>
            <a href={details.pr.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium hover:underline">
              #{details.pr.number} {details.pr.title} <ExternalLink size={12} />
            </a>
            <code className="text-xs text-muted">
              {details.pr.headRef} ← {details.pr.baseRef}
            </code>
          </div>

          <ol className="grid gap-2 text-xs sm:grid-cols-3">
            {(["pick", "check", "save"] as const).map((s, i) => (
              <li key={s} className="rounded-lg border px-2 py-1.5">
                <b>{i + 1}.</b> {t(`conflicts.steps.${s}`)}
              </li>
            ))}
          </ol>

          {details.files.length === 0 && <p className="text-emerald-400">{t("conflicts.noneInPr")}</p>}
          {!details.pr.sameRepo && <p className="text-amber-300">{t("conflicts.fork")}</p>}

          <div className="flex flex-wrap gap-1.5">
            {details.files.map((f) => {
              const st = states[f.path];
              return (
                <button key={f.path} type="button" className={cn("chip font-mono text-xs", active === f.path && "chip-active")} onClick={() => setActive(f.path)} data-testid="conflicts-file">
                  {!f.editable ? <TriangleAlert size={12} className="text-amber-300" /> : st?.ok ? <Check size={12} className="text-emerald-400" /> : <span className="h-2 w-2 rounded-full bg-red-400" />}
                  {f.path}
                  {f.editable && <span className="text-muted">({conflictCount(texts[f.path] ?? "")})</span>}
                </button>
              );
            })}
          </div>

          {file && !file.editable && (
            <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">{t("conflicts.notEditable", { size: Math.round(file.size / 1024) })}</p>
          )}

          {file?.editable && (
            <>
              {segments.some((s) => s.kind === "conflict") && (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="text-muted">{t("conflicts.all")}</span>
                    <button type="button" className="btn btn-sm" onClick={() => setText(resolveAll(text, "ours"))} data-testid="conflicts-all-pr">
                      {t("conflicts.takePr")}
                    </button>
                    <button type="button" className="btn btn-sm" onClick={() => setText(resolveAll(text, "theirs"))}>
                      {t("conflicts.takeBase")}
                    </button>
                    <button type="button" className="btn btn-sm" onClick={() => setText(resolveAll(text, "both"))}>
                      {t("conflicts.takeBoth")}
                    </button>
                  </div>
                  {segments.map((s, i) => {
                    if (s.kind !== "conflict") return null;
                    conflictNo++;
                    const n = conflictNo;
                    return (
                      <div key={i} className="rounded-xl border border-red-500/30 p-2" data-testid="conflicts-hunk">
                        <p className="mb-1 text-xs font-medium">{t("conflicts.hunk", { n: n + 1 })}</p>
                        <div className={cn("grid gap-2", s.base !== null ? "md:grid-cols-3" : "md:grid-cols-2")}>
                          {[
                            { key: "ours" as const, label: t("conflicts.sidePr"), body: s.ours },
                            ...(s.base !== null ? [{ key: "base" as const, label: t("conflicts.sideCommon"), body: s.base }] : []),
                            { key: "theirs" as const, label: t("conflicts.sideBase"), body: s.theirs },
                          ].map((side) => (
                            <div key={side.key} className="min-w-0">
                              <div className="mb-1 flex items-center gap-2 text-[11px] text-muted">
                                {side.label}
                                <button type="button" className="btn btn-sm ml-auto !py-0" onClick={() => choose(n, side.key)}>
                                  {t("conflicts.take")}
                                </button>
                              </div>
                              <pre className="max-h-40 overflow-auto rounded-lg border bg-bg/40 p-2 font-mono text-[11px]">{side.body || " "}</pre>
                            </div>
                          ))}
                        </div>
                        <button type="button" className="btn btn-sm mt-1 !py-0 text-xs" onClick={() => choose(n, "both")}>
                          {t("conflicts.takeBoth")}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <div>
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <label className="label !mb-0" htmlFor="conflict-editor">{t("conflicts.editor", { path: file.path })}</label>
                  {active?.endsWith(".json") && (
                    <button type="button" className="btn btn-sm" disabled={!formatJson(text)} onClick={() => setText(formatJson(text) ?? text)}>
                      <Wand2 size={13} /> {t("conflicts.formatJson")}
                    </button>
                  )}
                  <button type="button" className="btn btn-sm" onClick={() => setText(file.merged)}>
                    <RotateCcw size={13} /> {t("conflicts.reset")}
                  </button>
                </div>
                <textarea
                  id="conflict-editor"
                  className="field min-h-72 font-mono text-xs leading-relaxed"
                  spellCheck={false}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  data-testid="conflicts-textarea"
                />
                {syntax && (
                  <p className={cn("mt-1 text-xs", syntax.ok ? "text-emerald-400" : "text-red-400")} data-testid="conflicts-syntax">
                    {syntax.ok ? t("conflicts.syntax.ok") : t(`conflicts.syntax.${syntax.problem!}`, { line: syntax.line ?? "?", detail: syntax.detail ?? "" })}
                  </p>
                )}
              </div>
            </>
          )}

          <div className="flex flex-wrap items-center gap-2 border-t border-fg/10 pt-3">
            {canEdit ? (
              <button type="button" className="btn btn-primary btn-sm" disabled={busy || !canSave} onClick={() => void save()} data-testid="conflicts-save">
                <Save size={14} /> {t("conflicts.save", { branch: details.pr.headRef })}
              </button>
            ) : (
              <p className="text-xs text-muted">{t("conflicts.ownerOnly")}</p>
            )}
            {openMarkers > 0 && <span className="text-xs text-red-400">{t("conflicts.openFiles", { n: openMarkers })}</span>}
          </div>

          <details className="text-xs">
            <summary className="cursor-pointer text-muted">{t("conflicts.local")}</summary>
            <pre className="mt-1 overflow-auto rounded-lg border bg-bg/40 p-2 font-mono">{`git fetch origin\ngit switch ${details.pr.headRef}\ngit merge origin/${details.pr.baseRef}\n# Konflikte lösen, dann:\ngit add -A && git commit\ngit push`}</pre>
          </details>
          {details.messages && (
            <details className="text-xs">
              <summary className="cursor-pointer text-muted">{t("conflicts.gitMessages")}</summary>
              <pre className="mt-1 max-h-40 overflow-auto rounded-lg border bg-bg/40 p-2 font-mono">{details.messages}</pre>
            </details>
          )}
        </div>
      )}
    </section>
  );
}
