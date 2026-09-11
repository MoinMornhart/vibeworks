"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Database, Download, Upload } from "lucide-react";
import { FormError } from "@/components/ui/FormError";
import { api, ApiClientError, errorMessage } from "@/lib/client/api";
import { useT } from "@/lib/i18n/client";
import { AccountSection } from "./AccountManager";

interface Counts {
  projects: number;
  tasks: number;
  notes: number;
  docs: number;
}

/** Alles als JSON sichern oder einen Export wieder einlesen. */
export function DataSection() {
  const t = useT("data");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setDone(null);
    setError(null);
    try {
      let data: unknown;
      try {
        data = JSON.parse(await file.text());
      } catch {
        setError(t("section.invalidFile"));
        return;
      }
      const { counts } = await api<{ counts: Counts }>("/api/import", { body: data });
      setDone(
        t("section.imported", {
          projects: t("section.projects", { n: counts.projects }),
          tasks: t("templates.tasks", { n: counts.tasks }),
          notes: t("templates.notes", { n: counts.notes }),
          docs: t("section.docs", { n: counts.docs }),
        }),
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? errorMessage(err) : errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AccountSection icon={<Database size={18} />} title={t("section.title")} description={t("section.description")}>
      <div className="flex flex-wrap items-center gap-3">
        <a href="/api/export" download className="btn btn-primary btn-sm">
          <Download size={14} /> {t("export.all")}
        </a>
        <label className={`btn btn-sm cursor-pointer ${busy ? "pointer-events-none opacity-60" : ""}`}>
          <Upload size={14} /> {busy ? t("section.importing") : t("section.importLabel")}
          <input type="file" accept="application/json,.json" className="sr-only" onChange={(e) => void onFile(e)} disabled={busy} />
        </label>
      </div>
      <p className="mt-2 text-xs text-muted">{t("section.importHint")}</p>
      {done && <p role="status" className="mt-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">{done}</p>}
      <div className="mt-3">
        <FormError message={error} />
      </div>
    </AccountSection>
  );
}
