"use client";

import { useState } from "react";
import { Share2, Trash2, UserPlus } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { api, errorMessage } from "@/lib/client/api";
import { useT } from "@/lib/i18n/client";

type Role = "VIEWER" | "EDITOR";
interface Member {
  userId: string;
  role: Role;
  username: string;
  displayName: string | null;
}

// Eine Leinwand/Seite mit bestimmten Konten teilen (#211) – nur der Besitzer.
// Einladen per Benutzername, Rolle Ansehen/Bearbeiten, wieder entfernen.
export function ShareDocPanel({ docId }: { docId: string }) {
  const t = useT("docs");
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<Member[] | null>(null);
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<Role>("EDITOR");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      setMembers((await api<{ members: Member[] }>(`/api/docs/${docId}/share`, { method: "GET" })).members);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  function show() {
    setOpen(true);
    setMembers(null);
    void load();
  }

  async function act(body: object) {
    setBusy(true);
    setError(null);
    try {
      setMembers((await api<{ members: Member[] }>(`/api/docs/${docId}/share`, { body })).members);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function add() {
    const name = username.trim();
    if (!name) return;
    await act({ action: "add", username: name, role });
    setUsername("");
  }

  return (
    <>
      <button type="button" className="btn btn-sm" onClick={show} data-doc-share>
        <Share2 size={15} /> {t("share.button")}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={t("share.title")}>
        <div className="space-y-4">
          <p className="text-sm text-muted">{t("share.hint")}</p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-0 flex-1">
              <span className="label">{t("share.username")}</span>
              <input
                className="field"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void add(); }}
                placeholder={t("share.usernamePlaceholder")}
                aria-label={t("share.username")}
              />
            </label>
            <label>
              <span className="label">{t("share.role")}</span>
              <select className="field" value={role} onChange={(e) => setRole(e.target.value as Role)} aria-label={t("share.role")}>
                <option value="EDITOR">{t("share.roleEdit")}</option>
                <option value="VIEWER">{t("share.roleView")}</option>
              </select>
            </label>
            <button type="button" className="btn btn-primary" disabled={busy || !username.trim()} onClick={() => void add()} data-doc-share-add>
              <UserPlus size={15} /> {t("share.add")}
            </button>
          </div>
          {error && <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}

          {members === null ? (
            <p className="text-sm text-muted">{t("share.loading")}</p>
          ) : members.length === 0 ? (
            <p className="text-sm text-muted">{t("share.empty")}</p>
          ) : (
            <ul className="divide-y divide-fg/10" data-doc-share-list>
              {members.map((m) => (
                <li key={m.userId} className="flex items-center gap-2 py-2">
                  <span className="min-w-0 flex-1 truncate text-sm">{m.displayName || m.username} <span className="text-muted">@{m.username}</span></span>
                  <select
                    className="field h-8 py-0 text-xs"
                    value={m.role}
                    disabled={busy}
                    onChange={(e) => void act({ action: "role", userId: m.userId, role: e.target.value })}
                    aria-label={t("share.role")}
                  >
                    <option value="EDITOR">{t("share.roleEdit")}</option>
                    <option value="VIEWER">{t("share.roleView")}</option>
                  </select>
                  <button type="button" className="rounded-md p-1.5 text-muted hover:bg-red-500/15 hover:text-red-400" disabled={busy} onClick={() => void act({ action: "remove", userId: m.userId })} title={t("share.remove")} aria-label={t("share.remove")}>
                    <Trash2 size={15} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Modal>
    </>
  );
}
