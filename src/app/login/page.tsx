import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";
import { DemoLogin } from "@/components/auth/DemoLogin";
import { config } from "@/lib/config";
import { isSetupDone, registrationOpen } from "@/lib/settings";
import { currentUser } from "@/lib/auth/guard";
import { safeNext } from "@/lib/validation";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getT("auth");
  return { title: t("meta.login") };
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; abgelaufen?: string }> }) {
  if (!(await isSetupDone())) redirect("/setup");
  const params = await searchParams;
  const next = safeNext(params.next);
  if (await currentUser()) redirect(next);
  const t = await getT("auth");
  return (
    <AuthShell title={t("login.title")} subtitle={t("login.subtitle")}>
      {/* Sitzung im Leerlauf oder nach der Höchstdauer beendet – sagen, warum, statt stumm zurückzuspringen */}
      {params.abgelaufen === "1" && (
        <p role="status" className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-300" data-testid="session-expired">
          {t("login.expired", { hours: config.sessionIdleHours, days: config.sessionTtlDays })}
        </p>
      )}
      {config.demoMode && <DemoLogin next={next} />}
      <LoginForm next={next} allowRegistration={await registrationOpen()} allowReset />
    </AuthShell>
  );
}
