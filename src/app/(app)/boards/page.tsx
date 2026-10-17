import { requirePageUser } from "@/lib/auth/guard";
import { loadBoards } from "@/lib/docs";
import { getT } from "@/lib/i18n/server";
import { BoardsOverview } from "@/components/docs/BoardsOverview";

export async function generateMetadata() {
  const t = await getT("docs");
  return { title: t("boards.title") };
}

// Übersicht aller Leinwände (#211) – eine eigene Seite neben den Docs.
export default async function BoardsPage() {
  const user = await requirePageUser();
  return <BoardsOverview boards={await loadBoards(user.id)} />;
}
