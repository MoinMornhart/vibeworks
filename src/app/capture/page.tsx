import { redirect } from "next/navigation";
import { requirePageUser } from "@/lib/auth/guard";
import { isSetupDone } from "@/lib/settings";
import { getT } from "@/lib/i18n/server";
import { CapturePanel } from "@/components/CapturePanel";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getT("shell");
  return { title: t("capture.title") };
}

// Schnellerfassung ohne Navigation – das kleine Fenster der Windows-App lädt diese Seite.
export default async function CapturePage() {
  if (!(await isSetupDone())) redirect("/setup");
  await requirePageUser();
  return (
    <main className="flex min-h-dvh items-start justify-center p-3">
      <CapturePanel />
    </main>
  );
}
