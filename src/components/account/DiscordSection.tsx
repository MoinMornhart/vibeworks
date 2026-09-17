"use client";

import { useEffect, useState } from "react";
import { Send, Trash2 } from "lucide-react";
import { api, errorMessage } from "@/lib/client/api";
import { useMsg, useT } from "@/lib/i18n/client";
import { Toggle } from "@/components/theme/controls";
import { toast } from "@/components/ui/Toaster";
import { REPORT_MODES, type ReportMode } from "@/lib/discord/modes";
import type { DiscordLinkView } from "@/lib/discord/view";
import { DiscordIcon } from "@/components/admin/DiscordAdminSection";
import { AccountSection } from "./AccountManager";

const RESULT_KEYS = ["denied", "state", "install"] as const;

/** Discord-Server des Kontos (#105): per Klick verbinden, Kanal, Weiterleitung, Kurzbericht. */
export function DiscordSection({ isAdmin }: { isAdmin: boolean }) {
  const t = useT("discord");
  const [ready, setReady] = useState<boolean | null>(null);
  const [links, setLinks] = useState<DiscordLinkView[]>([]);

  useEffect(() => {
    api<{ ready: boolean; links: DiscordLinkView[] }>("/api/account/discord")
      .then((r) => {
        setReady(r.ready);
        setLinks(r.links);
      })
      .catch((e) => toast(errorMessage(e), "error"));
    // Ergebnis der Rückkehr von Discord einmal melden – kurz warten, bis der Toaster zuhört
    const q = new URLSearchParams(window.location.search);
    const result = q.get("discord");
    const guild = q.get("guild") ?? "";
    const timer = window.setTimeout(() => {
      if (result === "ok") toast(t("connected", { guild }));
      else if (result && (RESULT_KEYS as readonly string[]).includes(result)) toast(t("connectFailed", { error: t(`errors.${result as (typeof RESULT_KEYS)[number]}`) }), "error");
      else if (result === "notReady") toast(t("notReady"), "error");
    }, 300);
    if (result) {
      q.delete("discord");
      q.delete("guild");
      window.history.replaceState(null, "", `${window.location.pathname}${q.size ? `?${q}` : ""}${window.location.hash}`);
    }
    return () => window.clearTimeout(timer);
  }, [t]);

  return (
    <AccountSection id="discord" icon={<DiscordIcon />} title={t("section.title")} description={t("section.description")}>
      <div className="space-y-4" data-testid="discord-section">
        {ready === false && (
          <p className="text-sm text-muted" data-testid="discord-not-ready">
            {t("notReady")} {isAdmin && t("notReadyAdmin")}
          </p>
        )}
        {links.map((l) => (
          <DiscordLinkCard key={l.id} link={l} onChange={(x) => setLinks((ls) => ls.map((y) => (y.id === x.id ? x : y)))} onRemove={() => setLinks((ls) => ls.filter((y) => y.id !== l.id))} />
        ))}
        {ready && (
          <div className="space-y-2">
            {/* Normaler Link: Weiterleitung zu Discord und zurück */}
            <a href="/api/discord/install" className="btn btn-primary btn-sm" data-testid="discord-connect">
              <DiscordIcon /> {t("connect")}
            </a>
            <p className="text-xs text-muted">{t("connectHint")}</p>
          </div>
        )}
      </div>
    </AccountSection>
  );
}

function DiscordLinkCard({ link, onChange, onRemove }: { link: DiscordLinkView; onChange: (l: DiscordLinkView) => void; onRemove: () => void }) {
  const t = useT("discord");
  const msg = useMsg();
  const [channels, setChannels] = useState<Array<{ id: string; name: string }> | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ channels: Array<{ id: string; name: string }> }>(`/api/account/discord/${link.id}`)
      .then((r) => setChannels(r.channels))
      .catch(() => setChannels([]));
  }, [link.id]);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  }
  const patch = (body: Record<string, unknown>) => run(async () => onChange((await api<{ link: DiscordLinkView }>(`/api/account/discord/${link.id}`, { method: "PATCH", body })).link));
  const sendReport = () =>
    run(async () => {
      onChange((await api<{ link: DiscordLinkView }>(`/api/account/discord/${link.id}`, { body: {} })).link);
      toast(t("reportSent"));
    });
  const remove = () => {
    if (!window.confirm(t("confirmRemove", { guild: link.guildName ?? link.guildId }))) return;
    void run(async () => {
      await api(`/api/account/discord/${link.id}`, { method: "DELETE" });
      onRemove();
    });
  };

  // Gespeicherter Kanal auch dann wählbar, wenn die Liste (noch) fehlt
  const options = channels ?? [];
  const list = link.channelId && !options.some((c) => c.id === link.channelId) ? [{ id: link.channelId, name: link.channelName ?? link.channelId }, ...options] : options;

  return (
    <div className="space-y-3 rounded-2xl border bg-bg/25 p-4" data-testid="discord-link">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{link.guildName ?? link.guildId}</span>
        {link.discordName && <span className="text-xs text-muted">{t("by", { name: link.discordName })}</span>}
        <button type="button" className="btn btn-ghost btn-sm ml-auto hover:text-red-400" disabled={busy} onClick={remove} data-testid="discord-remove">
          <Trash2 size={13} /> {t("remove")}
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted">{t("channel")}</span>
          <select className="field" value={link.channelId ?? ""} disabled={busy || channels === null} onChange={(e) => void patch({ channelId: e.target.value || null })} data-testid="discord-channel">
            <option value="">{t("noChannel")}</option>
            {list.map((c) => (
              <option key={c.id} value={c.id}>
                #{c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted">{t("reportLabel")}</span>
          <select className="field" value={link.report} disabled={busy} onChange={(e) => void patch({ report: e.target.value as ReportMode })} data-testid="discord-report">
            {REPORT_MODES.map((m) => (
              <option key={m} value={m}>
                {t(`reportMode.${m}`)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <Toggle label={t("forward")} checked={link.forward} onChange={(v) => void patch({ forward: v })} />
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn btn-sm" disabled={busy || !link.channelId} onClick={() => void sendReport()} data-testid="discord-send-report">
          <Send size={13} /> {t("sendReport")}
        </button>
        <span className="text-xs text-muted">{t("commands")}</span>
      </div>
      {link.lastError && <p className="text-xs text-red-400" data-testid="discord-error">{t("lastError", { error: msg(link.lastError) })}</p>}
    </div>
  );
}
