import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { isSetupDone, registrationOpen } from "@/lib/settings";
import { currentUser } from "@/lib/auth/guard";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getT("auth");
  return { title: t("meta.register") };
}

export default async function RegisterPage() {
  if (!(await isSetupDone())) redirect("/setup");
  if (await currentUser()) redirect("/");
  const t = await getT("auth");
  if (!(await registrationOpen())) {
    return (
      <AuthShell title={t("register.closedTitle")} subtitle={t("register.closedSubtitle")}>
        <Link href="/login" className="btn w-full">{t("register.toLogin")}</Link>
      </AuthShell>
    );
  }
  return (
    <AuthShell title={t("register.title")}>
      <RegisterForm />
    </AuthShell>
  );
}
