import { z } from "zod";
import { json, readBody, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { requireProject } from "@/lib/access";
import { allowPullRequest, checkPullRequests, cleanupPullRequest, filterView, saveFilter } from "@/lib/git/fileFilter";
import { normalizeFilter } from "@/lib/git/fileFilterLogic";
import { db } from "@/lib/db";
import { limitOrThrow, MINUTE } from "@/lib/security/rateLimit";

type Params = { id: string };

// Dateifilter (#92): ansehen darf, wer das Projekt sieht; Regeln ändern und ins
// Repository schreiben (Aufräum-PR, Commit-Status) nur der Besitzer – es läuft
// über seinen Git-Zugang.

const rule = z.object({ pattern: z.string().max(200), kind: z.enum(["trash", "protected"]) });
const putSchema = z.object({ rules: z.array(rule).max(100) });
const postSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("cleanup"), files: z.array(z.string().max(500)).min(1).max(200), patterns: z.array(z.string().max(200)).max(50).default([]) }),
  z.object({ action: z.literal("allow"), pr: z.number().int().positive(), sha: z.string().max(64) }),
  z.object({ action: z.literal("check") }),
]);

const BRANCH = /^(?!.*\.\.)[\w][\w./-]*$/;

// Zweig wählbar (#109): geprüft wird die lokale Kopie dieses Zweigs
export const GET = route<Params>(async (req, { params }) => {
  const user = await requireApiUser();
  const { project } = await requireProject(user.id, (await params).id);
  limitOrThrow(`file-filter:${user.id}`, 30, MINUTE);
  const branch = req.nextUrl.searchParams.get("branch");
  return json({ view: await filterView(project.id, branch && BRANCH.test(branch) ? branch : null) });
});

export const PUT = route<Params>(async (req, { params }) => {
  const user = await requireApiUser();
  const { project } = await requireProject(user.id, (await params).id, "OWNER");
  const { rules } = await readBody(req, putSchema, { maxBytes: 16_000 });
  const current = await db.project.findUnique({ where: { id: project.id }, select: { fileFilter: true } });
  const old = normalizeFilter(current?.fileFilter);
  // Neue Regeln: frühere Prüfungen gelten nicht mehr
  await saveFilter(project.id, { ...old, rules: normalizeFilter({ rules }).rules, checked: {} });
  return json({ view: await filterView(project.id) });
});

export const POST = route<Params>(async (req, { params }) => {
  const user = await requireApiUser();
  const { project } = await requireProject(user.id, (await params).id, "OWNER");
  const input = await readBody(req, postSchema, { maxBytes: 64_000 });
  limitOrThrow(`file-filter-write:${user.id}`, 10, 10 * MINUTE);
  if (input.action === "cleanup") {
    const patterns = normalizeFilter({ rules: input.patterns.map((pattern) => ({ pattern, kind: "trash" })) }).rules.map((r) => r.pattern);
    const pr = await cleanupPullRequest(project.id, input.files, patterns);
    return json({ pr, view: await filterView(project.id) });
  }
  if (input.action === "allow") await allowPullRequest(project.id, input.pr, input.sha);
  else await checkPullRequests(project.id);
  return json({ view: await filterView(project.id) });
});
