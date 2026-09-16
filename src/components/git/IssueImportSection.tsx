"use client";

import { useState } from "react";
import { Plus, Trash2, UserCheck } from "lucide-react";
import { GIT_ROLES, type GitPerson, type GitRole, type IssueImportMode } from "@/lib/git/issueImportLogic";
import { useT } from "@/lib/i18n/client";

/**
 * Issues aus dem Git-System übernehmen und GitHub-Konten Rollen geben (#69):
 * Arbeiter und Bughunter gelten als vertrauenswürdig – ihre Issues werden
 * Aufgaben, und sie dürfen dem Bot Befehle geben.
 */
export function IssueImportSection({
  mode,
  people,
  busy,
  onSave,
}: {
  mode: IssueImportMode;
  people: GitPerson[];
  busy: boolean;
  onSave: (body: { issueImport?: IssueImportMode; gitPeople?: GitPerson[] }) => void;
}) {
  const t = useT("git");
  const [login, setLogin] = useState("");
  const [role, setRole] = useState<GitRole>("worker");

  const add = () => {
    const name = login.trim().replace(/^@/, "");
    if (!name) return;
    onSave({ gitPeople: [...people.filter((p) => p.login.toLowerCase() !== name.toLowerCase()), { login: name, role }] });
    setLogin("");
  };

  return (
    <div className="space-y-3 rounded-xl border px-3 py-3 text-sm" data-testid="issue-import">
      <div>
        <label className="label" htmlFor="issue-import-mode">{t("access.import.title")}</label>
        <select id="issue-import-mode" className="field !w-auto" value={mode} disabled={busy} onChange={(e) => onSave({ issueImport: e.target.value as IssueImportMode })}>
          <option value="trusted">{t("access.import.trusted")}</option>
          <option value="all">{t("access.import.all")}</option>
          <option value="off">{t("access.import.off")}</option>
        </select>
        <p className="mt-1 text-xs text-muted">{t(`access.import.hint.${mode}`)}</p>
      </div>
      <div>
        <p className="flex items-center gap-1.5 font-medium">
          <UserCheck size={14} className="text-accent-ink" /> {t("access.people.title")}
        </p>
        <p className="text-xs text-muted">{t("access.people.hint")}</p>
        {people.length > 0 && (
          <ul className="mt-2 space-y-1">
            {people.map((p) => (
              <li key={p.login} className="flex items-center gap-2" data-testid="git-person">
                <span className="font-mono text-xs">@{p.login}</span>
                <span className="rounded bg-fg/10 px-1.5 text-[11px]">{t(`access.people.roles.${p.role}`)}</span>
                <button
                  type="button"
                  className="btn btn-ghost btn-icon btn-sm ml-auto hover:!text-red-400"
                  disabled={busy}
                  aria-label={t("access.people.remove", { login: p.login })}
                  onClick={() => onSave({ gitPeople: people.filter((x) => x.login !== p.login) })}
                >
                  <Trash2 size={13} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <form
          className="mt-2 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <input
            className="field min-w-0 flex-1 !py-1 font-mono text-xs"
            placeholder={t("access.people.placeholder")}
            aria-label={t("access.people.placeholder")}
            value={login}
            maxLength={100}
            onChange={(e) => setLogin(e.target.value)}
            data-testid="git-person-login"
          />
          <select className="field !w-auto !py-1 text-xs" value={role} onChange={(e) => setRole(e.target.value as GitRole)} aria-label={t("access.people.role")}>
            {GIT_ROLES.map((r) => (
              <option key={r} value={r}>
                {t(`access.people.roles.${r}`)}
              </option>
            ))}
          </select>
          <button className="btn btn-sm" disabled={busy || !login.trim()} data-testid="git-person-add">
            <Plus size={13} /> {t("access.people.add")}
          </button>
        </form>
      </div>
    </div>
  );
}
