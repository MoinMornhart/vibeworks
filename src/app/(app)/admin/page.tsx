import { requirePageAdmin } from "@/lib/auth/guard";
import { getSettings } from "@/lib/settings";
import { listUsers } from "@/lib/admin";
import { config } from "@/lib/config";
import { buildInfo, publicBuildInfo } from "@/lib/buildInfo";
import { readUpdateStatus, selfUpdateAvailable } from "@/lib/selfUpdate";
import { AdminManager } from "@/components/admin/AdminManager";

export const metadata = { title: "Administration" };

export default async function AdminPage() {
  const me = await requirePageAdmin();
  const [settings, users, available, { status, log }] = await Promise.all([getSettings(), listUsers(), selfUpdateAvailable(), readUpdateStatus()]);
  return (
    <AdminManager
      meId={me.id}
      initialSettings={{ mode: settings.mode, allowRegistration: settings.allowRegistration, taskColumnLimit: settings.taskColumnLimit }}
      initialUsers={users}
      build={{ ...publicBuildInfo(), builtAt: buildInfo().builtAt, source: buildInfo().source }}
      appUrl={config.appUrl}
      update={{ available, installed: publicBuildInfo(), status, log }}
    />
  );
}
