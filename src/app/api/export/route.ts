import { route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { downloadResponse, exportData } from "@/lib/transfer";
import { dayKey } from "@/lib/utils";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";

// Alles exportieren: eigene Projekte (geteilte fremde nicht) und eigene Docs.
export const GET = route(async () => {
  const user = await requireApiUser();
  limitOrThrow(`export:${user.id}`, 20, 10 * MINUTE);
  const data = await exportData({ projectWhere: { ownerId: user.id }, docsOwnerId: user.id });
  return downloadResponse(data, `vibeworks-export-${dayKey(new Date())}.json`);
});
