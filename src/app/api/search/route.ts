import { json, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { searchContent } from "@/lib/searchQuery";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";

export const GET = route(async (req) => {
  const user = await requireApiUser();
  limitOrThrow(`search:${user.id}`, 120, MINUTE);
  return json(await searchContent(user.id, req.nextUrl.searchParams.get("q") ?? ""));
});
