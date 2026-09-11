import { requirePageUser } from "@/lib/auth/guard";
import { loadTree } from "@/lib/docs";
import { getT } from "@/lib/i18n/server";
import { DocsShell } from "@/components/docs/DocsShell";

export async function generateMetadata() {
  const t = await getT("docs");
  return { title: t("meta.title") };
}

export default async function DocsPage() {
  const user = await requirePageUser();
  return <DocsShell tree={await loadTree(user.id)} doc={null} />;
}
