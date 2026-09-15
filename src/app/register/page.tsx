import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { isSetupDone, registrationOpen } from "@/lib/settings";
import { inviteUsable } from "@/lib/invites";
import { currentUser } from "@/lib/auth/guard";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ invite?: string | string[] }> };

export async function generateMetadata() {
  const t = await getT("auth");
  return { title: t("meta.register") };
}

export default async function RegisterPage({ searchParams }: Props) {
  if (!(await isSetupDone())) redirect("/setup");
  if (await currentUser()) redirect("/");
  const t = await getT("auth");
  const { invite } = await searchParams;
  const token = typeof invite === "string" ? invite : null;
  const invited = token ? await inviteUsable(token) : false;
  if (!invited && !(await registrationOpen())) {
    return (
      <AuthShell title={t("register.closedTitle")} subtitle={token ? t("register.inviteInvalid") : t("register.closedSubtitle")}>
        <Link href="/login" className="btn w-full">{t("register.toLogin")}</Link>
      </AuthShell>
    );
  }
  return (
    <AuthShell title={t("register.title")} subtitle={invited ? t("register.invitedSubtitle") : undefined}>
      <RegisterForm invite={invited ? token! : undefined} />
    </AuthShell>
  );
}
