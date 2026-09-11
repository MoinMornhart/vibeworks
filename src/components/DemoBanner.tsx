import { Eye } from "lucide-react";
import { getLocale, getT } from "@/lib/i18n/server";

// Hinweisleiste über jeder Seite der Demo-Instanz (DEMO_MODE=true).
export async function DemoBanner() {
  const t = await getT("demo");
  const site = (await getLocale()) === "en" ? "https://moinmornhart.github.io/vibeworks/en/" : "https://moinmornhart.github.io/vibeworks/";
  return (
    <div role="note" data-testid="demo-banner" className="border-b border-accent/30 bg-accent/15 px-4 py-2 text-center text-sm">
      <Eye size={14} className="-mt-0.5 mr-1.5 inline text-accent-ink" aria-hidden />
      {t("banner.text")}{" "}
      <a href={site} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent-ink hover:underline">
        {t("banner.install")} →
      </a>
    </div>
  );
}
