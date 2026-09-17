import { AuthShell } from "@/components/auth/AuthShell";
import { LoginCheck } from "@/components/auth/LoginCheck";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return { title: (await getT("auth"))("mfa.check.title") };
}

// Nachfrage nach einer Notfall-Anmeldung (#109) – ohne Anmeldung erreichbar,
// der Link aus der E-Mail ist der Nachweis. Geantwortet wird per POST.
export default async function LoginCheckPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const t = await getT("auth");
  const token = (await searchParams).token ?? "";
  return (
    <AuthShell title={t("mfa.check.title")} subtitle={t("mfa.check.subtitle")}>
      <LoginCheck token={token} />
    </AuthShell>
  );
}
