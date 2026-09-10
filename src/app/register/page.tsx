import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { isSetupDone, registrationOpen } from "@/lib/settings";
import { currentUser } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Registrieren" };

export default async function RegisterPage() {
  if (!(await isSetupDone())) redirect("/setup");
  if (await currentUser()) redirect("/");
  if (!(await registrationOpen())) {
    return (
      <AuthShell title="Registrierung geschlossen" subtitle="Neue Konten legt hier ein Administrator an.">
        <Link href="/login" className="btn w-full">Zur Anmeldung</Link>
      </AuthShell>
    );
  }
  return (
    <AuthShell title="Konto anlegen">
      <RegisterForm />
    </AuthShell>
  );
}
