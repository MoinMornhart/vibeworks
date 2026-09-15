"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Crown, LogOut, Pencil, Plus, ShieldCheck, Trash2, UserPlus, UsersRound, X } from "lucide-react";
import type { TeamsOverview } from "@/lib/teams";
import { MAX_TEAM_NAME } from "@/lib/teamsLogic";
import { api, errorMessage } from "@/lib/client/api";
import { FormError } from "@/components/ui/FormError";
import { useFormat, useT } from "@/lib/i18n/client";
import { roleName } from "@/components/roles/roleName";
import { RolesManager } from "@/components/roles/RolesManager";

type Team = TeamsOverview["teams"][number];

function Initial({ name }: { name: string }) {
  return (
    <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-bold text-accent-ink">
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

/** Teams anlegen, Einladungen annehmen, Mitglieder und ihre Team-Rollen verwalten, Team-Projekte sehen. */
export function TeamsManager({ initial, meId }: { initial: TeamsOverview; meId: string }) {
  const t = useT("teams");
  const tr = useT("roles");
  const tsh = useT("share");
  const f = useFormat();
  const [data, setData] = useState(initial);
  const [name, setName] = useState("");
  const [invite, setInvite] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<{ overview: TeamsOverview }>) {
    setBusy(true);
    setError(null);
    try {
      setData((await fn()).overview);
      return true;
    } catch (e) {
      setError(errorMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (await run(() => api("/api/teams", { body: { name } }))) setName("");
  }

  const respond = (id: string, action: "accept" | "decline") => run(() => api(`/api/teams/invites/${id}`, { body: { action } }));

  function rename(team: Team) {
    const next = window.prompt(t("renamePrompt"), team.name)?.trim();
    if (next && next !== team.name) void run(() => api(`/api/teams/${team.id}`, { method: "PATCH", body: { name: next } }));
  }

  async function sendInvite(team: Team, e: React.FormEvent) {
    e.preventDefault();
    const username = invite[team.id]?.trim();
    if (!username) return;
    if (await run(() => api(`/api/teams/${team.id}/invites`, { body: { username } }))) setInvite((s) => ({ ...s, [team.id]: "" }));
  }

  // Nach Änderungen an den Team-Rollen: Namen und Auswahl neu laden
  const reload = () => void run(() => api("/api/teams"));

  const roleLabel = (team: Team, role: { name: string; key: string | null } | null, fallbackId: string) => {
    if (role) return roleName(role, tr);
    const known = team.roles.find((r) => r.id === fallbackId);
    return known ? roleName(known, tr) : "–";
  };

  return (
    <div className="fade-in space-y-6">
      <header>
        <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight">
          <UsersRound size={28} className="text-accent-ink" /> {t("title")}
        </h1>
        <p className="mt-1 max-w-3xl text-muted">{t("intro")}</p>
      </header>

      {data.invites.length > 0 && (
        <section className="glass border-accent/40 p-5" aria-labelledby="team-invites" data-testid="team-invites">
          <h2 id="team-invites" className="mb-3 font-semibold">{t("invitesTitle")}</h2>
          <ul className="space-y-2">
            {data.invites.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-3 rounded-xl border bg-bg/25 px-3 py-2">
                <span className="min-w-0 flex-1">
                  <b>{i.team}</b>
                  {i.from && <span className="text-sm text-muted"> · {t("invitedBy", { name: i.from })}</span>}
                </span>
                <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void respond(i.id, "accept")}>
                  <Check size={14} /> {t("accept")}
                </button>
                <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void respond(i.id, "decline")}>
                  <X size={14} /> {t("decline")}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <form onSubmit={create} className="glass flex flex-wrap items-end gap-2 p-5">
        <div className="min-w-[14rem] flex-1">
          <label className="label" htmlFor="team-name">{t("create.label")}</label>
          <input id="team-name" className="field" maxLength={MAX_TEAM_NAME} placeholder={t("create.placeholder")} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <button className="btn btn-primary btn-sm" disabled={busy || !name.trim()}>
          <Plus size={14} /> {t("create.submit")}
        </button>
      </form>

      <FormError message={error} />

      {data.teams.length === 0 ? (
        <p className="glass px-6 py-10 text-center text-muted">{t("empty")}</p>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2" data-testid="teams">
          {data.teams.map((team) => (
            <section key={team.id} className="glass p-6" aria-label={team.name} data-testid="team">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <h2 className="mr-auto break-words text-xl font-semibold">
                  <Link href={`/teams/${team.id}`} className="hover:text-accent-ink" data-testid="team-open">
                    {team.name}
                  </Link>
                </h2>
                <span className="chip !py-0.5 text-[11px]">{roleLabel(team, team.myRole, "")}</span>
                {team.can.manage && (
                  <button type="button" className="btn btn-ghost btn-icon btn-sm" disabled={busy} onClick={() => rename(team)} aria-label={t("rename")} title={t("rename")}>
                    <Pencil size={14} />
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-ghost btn-icon btn-sm"
                  disabled={busy}
                  onClick={() => window.confirm(t("confirmLeave", { team: team.name })) && void run(() => api(`/api/teams/${team.id}/members/me`, { method: "DELETE" }))}
                  aria-label={t("leave")}
                  title={t("leave")}
                >
                  <LogOut size={14} />
                </button>
                {team.can.manage && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-icon btn-sm hover:!text-red-400"
                    disabled={busy}
                    onClick={() => window.confirm(t("confirmDelete", { team: team.name })) && void run(() => api(`/api/teams/${team.id}`, { method: "DELETE" }))}
                    aria-label={t("delete")}
                    title={t("delete")}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>

              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">{t("members")}</h3>
              <ul className="mb-4 divide-y divide-fg/10 rounded-2xl border">
                {team.members.map((m) => {
                  const options = team.roles.filter((r) => team.assignable.includes(r.id) || r.id === m.roleId);
                  return (
                    <li key={m.userId} className="flex flex-wrap items-center gap-3 px-3 py-2" data-testid="team-member">
                      <Initial name={m.name} />
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {m.name} <span className="text-muted">@{m.username}</span>
                        {m.userId === meId && <span className="text-muted"> ({t("you")})</span>}
                      </span>
                      {m.manager && <Crown size={12} className="text-amber-400" aria-hidden />}
                      {team.can.roles && (m.manageable || m.userId === meId) ? (
                        <select
                          className="field !w-auto !py-1 text-xs"
                          value={m.roleId}
                          disabled={busy}
                          aria-label={t("roleOf", { name: m.name })}
                          onChange={(e) => void run(() => api(`/api/teams/${team.id}/members/${m.userId}`, { method: "PATCH", body: { roleId: e.target.value } }))}
                        >
                          {options.map((r) => (
                            <option key={r.id} value={r.id} disabled={!team.assignable.includes(r.id)}>
                              {roleName(r, tr)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="chip !py-0.5 text-[11px]">{roleLabel(team, m.role, m.roleId)}</span>
                      )}
                      {team.can.remove && m.manageable && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-icon btn-sm hover:!text-red-400"
                          disabled={busy}
                          onClick={() => window.confirm(t("confirmRemove", { name: m.name })) && void run(() => api(`/api/teams/${team.id}/members/${m.userId}`, { method: "DELETE" }))}
                          aria-label={t("removeName", { name: m.name })}
                          title={t("remove")}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </li>
                  );
                })}
                {team.invites.map((i) => (
                  <li key={`invite-${i.userId}`} className="flex flex-wrap items-center gap-3 px-3 py-2 opacity-70">
                    <Initial name={i.name} />
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {i.name} <span className="text-muted">@{i.username}</span>
                    </span>
                    <span className="text-xs text-muted" suppressHydrationWarning>{t("invite.pending")} · {f.ago(i.since)}</span>
                    <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void run(() => api(`/api/teams/${team.id}/invites`, { method: "DELETE", body: { userId: i.userId } }))}>
                      {t("invite.revoke")}
                    </button>
                  </li>
                ))}
              </ul>

              {team.can.invite && (
                <form onSubmit={(e) => void sendInvite(team, e)} className="mb-5 flex flex-wrap gap-2">
                  <input
                    className="field min-w-0 flex-1"
                    placeholder={t("invite.placeholder")}
                    aria-label={t("invite.placeholder")}
                    maxLength={64}
                    autoComplete="off"
                    value={invite[team.id] ?? ""}
                    onChange={(e) => setInvite((s) => ({ ...s, [team.id]: e.target.value }))}
                  />
                  <button className="btn btn-sm" disabled={busy || !invite[team.id]?.trim()}>
                    <UserPlus size={14} /> {t("invite.submit")}
                  </button>
                </form>
              )}

              {team.can.roles && (
                <details className="mb-5 rounded-2xl border px-4 py-3" data-testid="team-roles">
                  <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
                    <ShieldCheck size={14} className="text-accent-ink" /> {t("rolesTitle")}
                  </summary>
                  <div className="mt-3">
                    <RolesManager mode="own" scope="team" teamId={team.id} onChanged={reload} />
                  </div>
                </details>
              )}

              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">{t("projects")}</h3>
              {team.projects.length === 0 ? (
                <p className="text-sm text-muted">{t("noProjects")}</p>
              ) : (
                <ul className="space-y-1.5">
                  {team.projects.map((p) => (
                    <li key={p.id} className="flex items-center gap-2 text-sm">
                      <Link href={`/projects/${p.id}`} className="min-w-0 flex-1 truncate font-medium hover:text-accent-ink">{p.name}</Link>
                      <span className="text-xs text-muted">{t("sharedBy", { name: p.owner })}</span>
                      <span className="chip !py-0.5 text-[11px]">{p.role ? roleName(p.role, tr) : tsh("role.VIEWER")}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
