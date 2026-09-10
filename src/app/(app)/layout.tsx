import { redirect } from "next/navigation";
import { TopNav } from "@/components/TopNav";
import { ChangelogButton } from "@/components/ChangelogButton";
import { CommandPalette } from "@/components/CommandPalette";
import { QuickCapture } from "@/components/QuickCapture";
import { displayNameOf, requirePageUser } from "@/lib/auth/guard";
import { isSetupDone } from "@/lib/settings";
import { config } from "@/lib/config";

export const dynamic = "force-dynamic";

// Rahmen für alle Seiten hinter der Anmeldung.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!(await isSetupDone())) redirect("/setup");
  const user = await requirePageUser();
  const isAdmin = user.role === "ADMIN";

  return (
    <div className="flex min-h-dvh flex-col">
      <TopNav appName={config.appName} user={{ name: displayNameOf(user), username: user.username, isAdmin }} />
      <main className="mx-auto w-full max-w-7xl flex-1 px-3 py-6 sm:px-5 sm:py-8">{children}</main>
      <footer className="mx-auto w-full max-w-7xl px-5 pb-6 text-center text-xs text-muted">
        {config.appName} · <ChangelogButton />
      </footer>
      <CommandPalette isAdmin={isAdmin} />
      <QuickCapture />
    </div>
  );
}
