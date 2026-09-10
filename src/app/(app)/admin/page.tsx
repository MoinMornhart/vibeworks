import { requirePageAdmin } from "@/lib/auth/guard";
import { getSettings } from "@/lib/settings";
import { listUsers } from "@/lib/admin";
import { config } from "@/lib/config";
import { buildInfo, publicBuildInfo } from "@/lib/buildInfo";
import { AdminManager } from "@/components/admin/AdminManager";

export const metadata = { title: "Administration" };

export default async function AdminPage() {
  const me = await requirePageAdmin();
  const [settings, users] = await Promise.all([getSettings(), listUsers()]);
  return (
    <AdminManager
      meId={me.id}
      initialSettings={{ mode: settings.mode, allowRegistration: settings.allowRegistration, taskColumnLimit: settings.taskColumnLimit }}
      initialUsers={users}
      build={{ ...publicBuildInfo(), builtAt: buildInfo().builtAt, source: buildInfo().source }}
      appUrl={config.appUrl}
    />
  );
}
