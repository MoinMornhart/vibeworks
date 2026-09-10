import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";
import { isSetupDone, registrationOpen } from "@/lib/settings";
import { currentUser } from "@/lib/auth/guard";
import { safeNext } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const metadata = { title: "Anmelden" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (!(await isSetupDone())) redirect("/setup");
  const next = safeNext((await searchParams).next);
  if (await currentUser()) redirect(next);
  return (
    <AuthShell title="Anmelden" subtitle="Schön, dass du wieder da bist.">
      <LoginForm next={next} allowRegistration={await registrationOpen()} />
    </AuthShell>
  );
}
