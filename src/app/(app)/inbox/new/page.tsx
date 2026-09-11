import { requirePageUser } from "@/lib/auth/guard";
import { combineShared } from "@/lib/inbox";
import { getT } from "@/lib/i18n/server";
import { ShareIn } from "@/components/inbox/ShareIn";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getT("inbox");
  return { title: t("share.title") };
}

type Props = { searchParams: Promise<{ title?: string; text?: string; url?: string }> };

// Ziel des „Teilen“-Menüs (Web-App-Manifest, share_target): vorausgefüllt,
// abgelegt wird erst mit einem Klick – ein fremder Link allein legt nichts an.
export default async function ShareInPage({ searchParams }: Props) {
  await requirePageUser();
  const q = await searchParams;
  const { text, url } = combineShared({ title: q.title, text: q.text, url: q.url });
  return <ShareIn initialText={text} initialUrl={url} />;
}
