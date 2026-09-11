import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";
import { isSetupDone, registrationOpen } from "@/lib/settings";
import { currentUser } from "@/lib/auth/guard";
import { safeNext } from "@/lib/validation";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getT("auth");
  return { title: t("meta.login") };
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (!(await isSetupDone())) redirect("/setup");
  const next = safeNext((await searchParams).next);
  if (await currentUser()) redirect(next);
  const t = await getT("auth");
  return (
    <AuthShell title={t("login.title")} subtitle={t("login.subtitle")}>
      <LoginForm next={next} allowRegistration={await registrationOpen()} />
    </AuthShell>
  );
}
