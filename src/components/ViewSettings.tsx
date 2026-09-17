"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LayoutDashboard, Menu, Save, SlidersHorizontal } from "lucide-react";
import { MINIMAL_HIDDEN, UI_GROUPS, type UiKey, type UiPrefs } from "@/lib/uiPrefsLogic";
import { api, errorMessage } from "@/lib/client/api";
import { Toggle } from "@/components/theme/controls";
import { toast } from "@/components/ui/Toaster";
import { useT } from "@/lib/i18n/client";

const GROUP_ICON = { nav: Menu, dashboard: LayoutDashboard, project: SlidersHorizontal } as const;

/** Ansicht aufräumen (#109): Bereiche ausblenden, die man nicht braucht. */
export function ViewSettings({ initial }: { initial: UiPrefs }) {
  const t = useT("view");
  const router = useRouter();
  const [hidden, setHidden] = useState<string[]>(initial.hidden);
  const [busy, setBusy] = useState(false);

  const shown = (key: string) => !hidden.includes(key);
  const toggle = (key: string) => setHidden((list) => (list.includes(key) ? list.filter((k) => k !== key) : [...list, key]));

  async function save(next: string[] = hidden) {
    setBusy(true);
    try {
      const res = await api<{ view: UiPrefs }>("/api/account/view", { method: "PUT", body: { hidden: next } });
      setHidden(res.view.hidden);
      toast(t("saved"));
      // Menü, Dashboard und Projektseiten bauen der Server – neu holen
      router.refresh();
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fade-in space-y-5">
      <header>
        <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight">
          <Eye size={28} className="text-accent-ink" /> {t("title")}
        </h1>
        <p className="mt-1 text-muted">{t("subtitle")}</p>
      </header>

      <section className="glass flex flex-wrap items-center gap-3 p-4 text-sm" data-testid="view-summary">
        <span className={hidden.length ? "text-amber-400" : "text-emerald-400"}>{hidden.length ? t("hiddenCount", { n: hidden.length }) : t("nothingHidden")}</span>
        <span className="ml-auto flex flex-wrap gap-2">
          <button type="button" className="btn btn-sm" disabled={busy || !hidden.length} onClick={() => void save([])} data-testid="view-show-all">
            <Eye size={14} /> {t("showAll")}
          </button>
          <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void save([...MINIMAL_HIDDEN])} data-testid="view-minimal">
            <EyeOff size={14} /> {t("minimal")}
          </button>
          <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void save()} data-testid="view-save">
            <Save size={14} /> {t("save")}
          </button>
        </span>
      </section>

      <p className="text-xs text-muted">{t("hint")}</p>

      <div className="grid gap-5 lg:grid-cols-2">
        {UI_GROUPS.map((group) => {
          const Icon = GROUP_ICON[group.key];
          return (
            <section key={group.key} className="glass p-5 sm:p-6" data-testid={`view-group-${group.key}`}>
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Icon size={18} className="text-accent-ink" /> {t(`groups.${group.key}`)}
              </h2>
              <p className="mt-0.5 text-xs text-muted">{t(`groupHints.${group.key}`)}</p>
              <div className="mt-4 space-y-3">
                {group.keys.map((key) => (
                  <div key={key} data-testid={`view-toggle-${key}`}>
                    <Toggle label={t(`keys.${key as UiKey}`)} checked={shown(key)} onChange={() => toggle(key)} />
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
