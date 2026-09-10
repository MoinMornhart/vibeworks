import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { SetupForm } from "@/components/auth/SetupForm";
import { isSetupDone } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Einrichtung" };

export default async function SetupPage() {
  if (await isSetupDone()) redirect("/login");
  return (
    <AuthShell title="Willkommen!" subtitle="Lege das Administratorkonto an und wähle, wie VibeWorks betrieben wird.">
      <SetupForm />
    </AuthShell>
  );
}
