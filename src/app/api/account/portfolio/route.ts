import { json, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { portfolioSchema } from "@/lib/validation";
import { portfolioView, setPortfolio } from "@/lib/portfolio";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";

export const GET = route(async () => {
  const user = await requireApiUser();
  return json({ portfolio: await portfolioView(user.id) });
});

export const PUT = route(async (req) => {
  const user = await requireApiUser();
  limitOrThrow(`portfolio:${user.id}`, 30, 10 * MINUTE);
  const input = await readBody(req, portfolioSchema, { maxBytes: 32 * 1024 });
  await setPortfolio(user.id, input);
  return json({ portfolio: await portfolioView(user.id) });
});
