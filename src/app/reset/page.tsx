import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { ResetForm } from "@/components/auth/ResetForm";
import { isSetupDone } from "@/lib/settings";
import { resetAllowed, resetTarget } from "@/lib/auth/passwordReset";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ token?: string }> };

export async function generateMetadata() {
  return { title: (await getT("auth"))("reset.title") };
}

export default async function ResetPage({ searchParams }: Props) {
  if (!(await isSetupDone())) redirect("/setup");
  const t = await getT("auth");
  const allowed = await resetAllowed();
  const token = (await searchParams).token?.trim() ?? "";
  // Mit Link: prüfen, ob er noch gilt – ohne Link: nur das Anfrage-Feld
  const target = allowed && token ? await resetTarget(token) : null;
  return (
    <AuthShell title={t("reset.title")} subtitle={t(token ? "reset.subtitleToken" : "reset.subtitle")}>
      {!allowed ? (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-300" data-testid="reset-off">
          {t("reset.off")}
        </p>
      ) : (
        <ResetForm token={token} valid={Boolean(target)} username={target?.user.username ?? null} />
      )}
    </AuthShell>
  );
}
