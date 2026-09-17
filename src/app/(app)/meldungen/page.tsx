import { requirePageUser } from "@/lib/auth/guard";
import { notificationCenter } from "@/lib/notify/center";
import { getT } from "@/lib/i18n/server";
import { NotificationCenter } from "@/components/notify/NotificationCenter";

export async function generateMetadata() {
  return { title: (await getT("notices"))("title") };
}

// Meldungen (#109): alle Benachrichtigungen mit Filtern, eigene Regeln und
// die Aufgaben, die zu den wichtigen Wörtern passen.
export default async function NoticesPage() {
  const user = await requirePageUser();
  return <NotificationCenter initial={await notificationCenter(user.id)} />;
}
