import { json, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { getLocale } from "@/lib/i18n/server";
import { ensureWeeklySuggestions, loadWeekSuggestions } from "@/lib/suggestions";

// Die Vorschläge dieser Woche – beim ersten Abruf der Woche werden sie angelegt.
export const GET = route(async () => {
  const user = await requireApiUser();
  await ensureWeeklySuggestions(user.id, new Date(), await getLocale());
  return json({ suggestions: await loadWeekSuggestions(user.id) });
});
