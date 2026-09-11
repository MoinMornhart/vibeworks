import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { SetupForm } from "@/components/auth/SetupForm";
import { isSetupDone } from "@/lib/settings";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getT("auth");
  return { title: t("meta.setup") };
}

export default async function SetupPage() {
  if (await isSetupDone()) redirect("/login");
  const t = await getT("auth");
  return (
    <AuthShell title={t("setup.title")} subtitle={t("setup.subtitle")}>
      <SetupForm />
    </AuthShell>
  );
}
