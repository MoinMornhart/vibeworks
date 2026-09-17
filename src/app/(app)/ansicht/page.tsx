import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/guard";
import { readUiPrefs } from "@/lib/uiPrefsLogic";
import { getT } from "@/lib/i18n/server";
import { ViewSettings } from "@/components/ViewSettings";

export async function generateMetadata() {
  return { title: (await getT("view"))("title") };
}

// Ansicht (#109): Bereiche ausblenden, die dieses Konto nicht braucht.
export default async function ViewPage() {
  const user = await requirePageUser();
  const row = await db.user.findUnique({ where: { id: user.id }, select: { ui: true } });
  return <ViewSettings initial={readUiPrefs(row?.ui)} />;
}
