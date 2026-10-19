import { notFound } from "next/navigation";
import { cache } from "react";
import { requirePageUser } from "@/lib/auth/guard";
import { loadTree, serializeDoc } from "@/lib/docs";
import { docRoleOf } from "@/lib/docs/access";
import { getT } from "@/lib/i18n/server";
import { DocsShell } from "@/components/docs/DocsShell";

type Props = { params: Promise<{ id: string }> };

const loadDoc = cache(async (id: string) => {
  const user = await requirePageUser();
  // Auch mit mir geteilte Seiten/Leinwände, nicht nur eigene (#211).
  return docRoleOf(user.id, id);
});

export async function generateMetadata({ params }: Props) {
  const res = await loadDoc((await params).id);
  if (res) return { title: `${res.doc.icon ? `${res.doc.icon} ` : ""}${res.doc.title}` };
  const t = await getT("docs");
  return { title: t("meta.title") };
}

export default async function DocPage({ params }: Props) {
  const user = await requirePageUser();
  const { id } = await params;
  const [res, tree] = await Promise.all([loadDoc(id), loadTree(user.id)]);
  if (!res) notFound();
  return <DocsShell tree={tree} doc={serializeDoc(res.doc)} role={res.role} />;
}
