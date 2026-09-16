import type { NextRequest } from "next/server";
import { z } from "zod";
import { json, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { requireProject } from "@/lib/access";
import { projectCodeGraph } from "@/lib/codeGraph";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";

type Params = { id: string };

const branchSchema = z.string().trim().max(200).regex(/^(?!.*\.\.)[\w][\w./-]*$/).optional().catch(undefined);

// Code-Netz (#57, #60): nur Pfade, Import-Verbindungen und Memos, keine Inhalte – und nur für Projektmitglieder.
export const GET = route<Params>(async (req: NextRequest, { params }) => {
  const user = await requireApiUser();
  const { project } = await requireProject(user.id, (await params).id);
  limitOrThrow(`code-graph:${user.id}`, 30, 10 * MINUTE);
  const branch = branchSchema.parse(req.nextUrl.searchParams.get("branch") ?? undefined);
  return json({ graph: await projectCodeGraph(project.id, branch, { branches: true }) });
});
