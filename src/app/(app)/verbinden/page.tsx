import { PlugZap } from "lucide-react";
import { requirePageUser } from "@/lib/auth/guard";
import { getT } from "@/lib/i18n/server";
import { pendingByCode } from "@/lib/mcp/deviceAuth";
import { DeviceConnect } from "@/components/account/DeviceConnect";

// KI-Programm verbinden (#104): Code aus dem Programm prüfen und einmal freigeben.

export async function generateMetadata() {
  return { title: (await getT("mcp"))("device.title") };
}

export default async function ConnectPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  await requirePageUser();
  const [t, { code }] = await Promise.all([getT("mcp"), searchParams]);
  const initial = code ? await pendingByCode(code) : null;
  return (
    <div className="fade-in mx-auto max-w-xl space-y-6">
      <header>
        <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight">
          <PlugZap size={28} className="text-accent-ink" /> {t("device.title")}
        </h1>
        <p className="mt-1 text-muted">{t("device.intro")}</p>
      </header>
      <DeviceConnect initialCode={code ?? ""} initial={initial} />
    </div>
  );
}
