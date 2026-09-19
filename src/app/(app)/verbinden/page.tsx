import { PlugZap } from "lucide-react";
import { requirePageUser } from "@/lib/auth/guard";
import { getT } from "@/lib/i18n/server";
import { pendingByCode } from "@/lib/mcp/deviceAuth";
import { pendingByOAuthCode } from "@/lib/mcp/oauthFlow";
import { DeviceConnect } from "@/components/account/DeviceConnect";

// KI-Programm verbinden (#104, #141): Code aus dem Programm prüfen und einmal
// freigeben – für Geräte-Codes und OAuth-Autorisierungs-Codes dieselbe Seite
// und dieselbe bewusste Freigabe.

export async function generateMetadata() {
  return { title: (await getT("mcp"))("device.title") };
}

export default async function ConnectPage({ searchParams }: { searchParams: Promise<{ code?: string; oauth?: string }> }) {
  await requirePageUser();
  const [t, params] = await Promise.all([getT("mcp"), searchParams]);
  const code = params.oauth ?? params.code ?? "";
  // Erst als Geräte-Code suchen, sonst als OAuth-Code (#141)
  const device = code ? await pendingByCode(code) : null;
  const oauth = !device && code ? await pendingByOAuthCode(code) : null;
  const initial = device ?? oauth;
  return (
    <div className="fade-in mx-auto max-w-xl space-y-6">
      <header>
        <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight">
          <PlugZap size={28} className="text-accent-ink" /> {t("device.title")}
        </h1>
        <p className="mt-1 text-muted">{t("device.intro")}</p>
      </header>
      <DeviceConnect initialCode={code} initial={initial} />
    </div>
  );
}
