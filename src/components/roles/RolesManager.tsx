"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, Save, ShieldCheck, Trash2, X } from "lucide-react";
import type { RoleItem } from "@/lib/roles";
import { MAX_ROLE_DESCRIPTION, MAX_ROLE_NAME, PROJECT_PERMISSIONS, TEAM_PERMISSIONS, type RoleScope } from "@/lib/rolesLogic";
import { api, errorMessage } from "@/lib/client/api";
import { FormError } from "@/components/ui/FormError";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { permKey, roleDescription, roleName } from "./roleName";

type Mode = "own" | "admin";
interface Draft {
  id: string | null;
  name: string;
  description: string;
  permissions: string[];
}

const PERMS: Record<RoleScope, readonly (typeof PROJECT_PERMISSIONS[number] | typeof TEAM_PERMISSIONS[number])[]> = { project: PROJECT_PERMISSIONS, team: TEAM_PERMISSIONS };

function Editor({ scope, draft, onChange, onSave, onCancel, busy }: { scope: RoleScope; draft: Draft; onChange: (d: Draft) => void; onSave: () => void; onCancel: () => void; busy: boolean }) {
  const t = useT("roles");
  const toggle = (p: string) => onChange({ ...draft, permissions: draft.permissions.includes(p) ? draft.permissions.filter((x) => x !== p) : [...draft.permissions, p] });
  return (
    <div className="space-y-3 rounded-2xl border border-accent/40 bg-accent/5 p-4" data-testid="role-editor">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="role-name">{t("name")}</label>
          <input id="role-name" className="field" maxLength={MAX_ROLE_NAME} value={draft.name} onChange={(e) => onChange({ ...draft, name: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="role-desc">{t("description")}</label>
          <input id="role-desc" className="field" maxLength={MAX_ROLE_DESCRIPTION} value={draft.description} onChange={(e) => onChange({ ...draft, description: e.target.value })} />
        </div>
      </div>
      <fieldset>
        <legend className="label">{t("permissions")}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {PERMS[scope].map((p) => (
            <label key={p} className="flex cursor-pointer items-start gap-2 rounded-lg border bg-bg/30 px-3 py-2 text-sm">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--vw-accent)]" checked={draft.permissions.includes(p)} onChange={() => toggle(p)} />
              <span>
                {t(`perms.${permKey(p)}`)}
                {p === "members.invite" && <span className="block text-xs text-muted">{t("invitHint")}</span>}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex gap-2">
        <button type="button" className="btn btn-primary btn-sm" disabled={busy || !draft.name.trim()} onClick={onSave}>
          <Save size={14} /> {t("save")}
        </button>
        <button type="button" className="btn btn-sm" onClick={onCancel}>
          <X size={14} /> {t("cancel")}
        </button>
      </div>
    </div>
  );
}

/** Rollen ansehen, anlegen, bearbeiten: eigene (mode "own") oder Vorlagen der Instanz (mode "admin"). */
/** teamId: die eigenen Rollen dieses Teams · onChanged: nach jeder gespeicherten Änderung */
export function RolesManager({
  mode,
  initial,
  scope = "project",
  teamId,
  onChanged,
}: {
  mode: Mode;
  initial?: RoleItem[];
  scope?: RoleScope;
  teamId?: string;
  onChanged?: () => void;
}) {
  const t = useT("roles");
  const [roles, setRoles] = useState<RoleItem[] | null>(initial ?? null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initial) return;
    api<{ roles: RoleItem[] }>(teamId ? `/api/roles?teamId=${encodeURIComponent(teamId)}` : `/api/roles?scope=${scope}`)
      .then((r) => setRoles(r.roles))
      .catch((e) => setError(errorMessage(e)));
  }, [initial, scope, teamId]);

  async function run(fn: () => Promise<{ roles: RoleItem[] }>) {
    setBusy(true);
    setError(null);
    try {
      setRoles((await fn()).roles);
      setDraft(null);
      onChanged?.();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function save() {
    if (!draft) return;
    const body = { name: draft.name.trim(), description: draft.description.trim() || null, permissions: draft.permissions };
    void run(() =>
      draft.id ? api(`/api/roles/${draft.id}`, { method: "PATCH", body }) : api("/api/roles", { body: { ...body, scope, template: mode === "admin", ...(teamId ? { teamId } : {}) } }),
    );
  }

  const shown = (roles ?? []).filter((r) => (mode === "admin" ? r.template : true));

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted">{teamId ? t("teamRolesHint") : scope === "team" ? t("teamHint") : mode === "admin" ? t("introAdmin") : t("ownerOnly")}</p>
      <ul className="space-y-2" data-testid="roles">
        {shown.map((r) =>
          draft?.id === r.id ? (
            <li key={r.id}>
              <Editor scope={scope} draft={draft} onChange={setDraft} onSave={save} onCancel={() => setDraft(null)} busy={busy} />
            </li>
          ) : (
            <li key={r.id} className="rounded-2xl border bg-bg/25 p-4" data-testid="role">
              <div className="flex flex-wrap items-center gap-2">
                <ShieldCheck size={16} className="text-accent-ink" />
                <span className="font-semibold">{roleName(r, t)}</span>
                <span className="chip !py-0.5 text-[11px]">{r.builtIn ? t("kinds.builtIn") : r.template ? t("kinds.template") : r.team ? t("kinds.team") : t("kinds.own")}</span>
                <span className="ml-auto flex gap-1">
                  {r.editable && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon btn-sm"
                      disabled={busy}
                      onClick={() => setDraft({ id: r.id, name: r.name, description: r.description ?? "", permissions: [...r.permissions] })}
                      aria-label={t("edit")}
                      title={t("edit")}
                    >
                      <Pencil size={14} />
                    </button>
                  )}
                  {r.editable && !r.builtIn && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon btn-sm hover:!text-red-400"
                      disabled={busy}
                      onClick={() => window.confirm(t("confirmDelete", { name: r.name })) && void run(() => api(`/api/roles/${r.id}`, { method: "DELETE" }))}
                      aria-label={t("delete")}
                      title={t("delete")}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </span>
              </div>
              {roleDescription(r, t) && <p className="mt-1 text-sm text-muted">{roleDescription(r, t)}</p>}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {r.permissions.length === 0 ? (
                  <span className="text-xs text-muted">{t("none")}</span>
                ) : (
                  r.permissions.map((p) => (
                    <span key={p} className={cn("chip !py-0.5 text-[11px]", p === "members.invite" && "border-amber-500/40 text-amber-400")}>
                      {(PERMS[scope] as readonly string[]).includes(p) ? t(`perms.${permKey(p as (typeof PERMS)[RoleScope][number])}`) : p}
                    </span>
                  ))
                )}
              </div>
            </li>
          ),
        )}
      </ul>
      {draft && draft.id === null ? (
        <Editor scope={scope} draft={draft} onChange={setDraft} onSave={save} onCancel={() => setDraft(null)} busy={busy} />
      ) : (
        <button
          type="button"
          className="btn btn-sm"
          disabled={busy || !roles}
          onClick={() => setDraft({ id: null, name: "", description: "", permissions: scope === "team" ? [] : ["tasks.edit"] })}
        >
          <Plus size={14} /> {mode === "admin" ? t("createTemplate") : t("create")}
        </button>
      )}
      <FormError message={error} />
    </div>
  );
}
