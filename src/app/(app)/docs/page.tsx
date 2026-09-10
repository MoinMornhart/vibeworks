import { requirePageUser } from "@/lib/auth/guard";
import { loadTree } from "@/lib/docs";
import { DocsShell } from "@/components/docs/DocsShell";

export const metadata = { title: "Docs" };

export default async function DocsPage() {
  const user = await requirePageUser();
  return <DocsShell tree={await loadTree(user.id)} doc={null} />;
}
