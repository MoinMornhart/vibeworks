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
  // Ohne E-Mail-Versand gibt es keinen Link – die Bitte an den Admin bleibt aber immer möglich (#43).
  const allowed = await resetAllowed();
  const token = (await searchParams).token?.trim() ?? "";
  const target = allowed && token ? await resetTarget(token) : null;
  return (
    <AuthShell title={t("reset.title")} subtitle={t(token && allowed ? "reset.subtitleToken" : "reset.subtitle")}>
      <ResetForm token={token} valid={Boolean(target)} username={target?.user.username ?? null} allowed={allowed} />
    </AuthShell>
  );
}
