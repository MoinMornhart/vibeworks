"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, Save, UserRoundSearch } from "lucide-react";
import { FormError } from "@/components/ui/FormError";
import { Toggle } from "@/components/theme/controls";
import { api, errorMessage } from "@/lib/client/api";
import { useT } from "@/lib/i18n/client";
import type { PortfolioView } from "@/lib/portfolio";
import { AccountSection } from "./AccountManager";

/** Öffentliches Portfolio: ein-/ausschalten, Text über dich, Projekte auswählen. */
export function PortfolioSection({ initial }: { initial: PortfolioView }) {
  const t = useT("portfolio");
  const ts = useT("status");
  const [saved, setSaved] = useState(initial);
  const [pub, setPub] = useState(initial.public);
  const [bio, setBio] = useState(initial.bio);
  const [selected, setSelected] = useState(() => new Set(initial.projects.filter((p) => p.inPortfolio).map((p) => p.id)));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function save() {
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      const res = await api<{ portfolio: PortfolioView }>("/api/account/portfolio", { method: "PUT", body: { public: pub, bio, projectIds: [...selected] } });
      setSaved(res.portfolio);
      setNotice(t("saved"));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(saved.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* Zwischenablage gesperrt */
    }
  }

  return (
    <AccountSection icon={<UserRoundSearch size={18} />} title={t("section.title")} description={t("section.description")}>
      <div className="space-y-5" data-testid="portfolio-section">
        <Toggle label={t("public")} hint={t("publicHint")} checked={pub} onChange={setPub} />
        {saved.public && (
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded-lg border bg-black/30 p-2.5 font-mono text-xs">{saved.url}</code>
            <button type="button" className="btn btn-sm" onClick={() => void copy()}>{copied ? <Check size={14} /> : <Copy size={14} />} {copied ? t("copied") : t("copy")}</button>
            <a href={saved.url} target="_blank" rel="noopener noreferrer" className="btn btn-sm"><ExternalLink size={14} /> {t("open")}</a>
          </div>
        )}
        <div>
          <label className="label" htmlFor="portfolio-bio">{t("bio")}</label>
          <textarea id="portfolio-bio" className="field min-h-24" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={1000} placeholder={t("bioPlaceholder")} />
        </div>
        <fieldset>
          <legend className="label">{t("projects", { n: selected.size })}</legend>
          {initial.projects.length === 0 ? (
            <p className="text-sm text-muted">{t("noProjects")}</p>
          ) : (
            <ul className="grid max-h-72 gap-1 overflow-y-auto rounded-xl border p-2 sm:grid-cols-2">
              {initial.projects.map((p) => (
                <li key={p.id}>
                  <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-fg/5">
                    <input type="checkbox" className="h-4 w-4 accent-[var(--vw-accent)]" checked={selected.has(p.id)} onChange={() => toggle(p.id)} />
                    <span className="min-w-0 flex-1 truncate">{p.name}</span>
                    <span className="text-xs text-muted">{ts(`project.${p.status}`)}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </fieldset>
        <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void save()}><Save size={14} /> {t("save")}</button>
        {notice && <p role="status" className="text-sm text-emerald-400">{notice}</p>}
        <FormError message={error} />
      </div>
    </AccountSection>
  );
}
