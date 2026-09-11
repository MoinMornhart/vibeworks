import { notFound } from "next/navigation";
import { cache } from "react";
import { requirePageUser } from "@/lib/auth/guard";
import { findOwnDoc, loadTree, serializeDoc } from "@/lib/docs";
import { getT } from "@/lib/i18n/server";
import { DocsShell } from "@/components/docs/DocsShell";

type Props = { params: Promise<{ id: string }> };

const loadDoc = cache(async (id: string) => {
  const user = await requirePageUser();
  return findOwnDoc(user.id, id);
});

export async function generateMetadata({ params }: Props) {
  const doc = await loadDoc((await params).id);
  if (doc) return { title: `${doc.icon ? `${doc.icon} ` : ""}${doc.title}` };
  const t = await getT("docs");
  return { title: t("meta.title") };
}

export default async function DocPage({ params }: Props) {
  const user = await requirePageUser();
  const { id } = await params;
  const [doc, tree] = await Promise.all([loadDoc(id), loadTree(user.id)]);
  if (!doc) notFound();
  return <DocsShell tree={tree} doc={serializeDoc(doc)} />;
}
