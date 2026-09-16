import type { Metadata } from "next";
import { cookies } from "next/headers";
import { config } from "@/lib/config";
import { checkLink, LINK_GUARD_COOKIE } from "@/lib/linkCheckLogic";
import { GoPanel } from "@/components/GoPanel";

// Hinweisseite für Links (#65) – öffentlich, weil auch geteilte Seiten Links
// enthalten. Sie zeigt nur die Prüfung der Adresse; weitergeleitet wird nie
// vom Server, sondern höchstens im Browser (siehe GoPanel).

export const dynamic = "force-dynamic";

// Das Ziel erfährt nicht, dass der Link aus VibeWorks kam
export const metadata: Metadata = { referrer: "no-referrer", robots: { index: false, follow: false } };

export default async function GoPage({ searchParams }: { searchParams: Promise<{ to?: string | string[] }> }) {
  const raw = (await searchParams).to;
  const to = (Array.isArray(raw) ? raw[0] : raw)?.slice(0, 4000) ?? "";
  const check = checkLink(to, config.appUrl);
  const guardOff = (await cookies()).get(LINK_GUARD_COOKIE)?.value === "off";
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl items-center px-4 py-10">
      <GoPanel check={check} guardOff={guardOff} />
    </main>
  );
}
