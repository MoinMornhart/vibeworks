import { db } from "@/lib/db";
import { json, route } from "@/lib/api";
import { displayNameOf, requireApiAdmin } from "@/lib/auth/guard";
import { communityOn } from "@/lib/community";
import { excerpt } from "@/lib/communityLogic";

// Admin-Übersicht: offene Meldungen (je Ziel zusammengefasst) und instanzweit gesperrte Konten.
export const GET = route(async () => {
  await requireApiAdmin();
  if (!(await communityOn())) return json({ off: true, reports: [], bans: [] });

  const reports = await db.communityReport.findMany({ where: { status: "open" }, orderBy: { createdAt: "desc" }, take: 300 });
  const postIds = [...new Set(reports.filter((r) => r.targetType === "post").map((r) => r.targetId))];
  const replyIds = [...new Set(reports.filter((r) => r.targetType === "reply").map((r) => r.targetId))];
  const author = { select: { id: true, username: true, displayName: true } } as const;
  const [posts, replies] = await Promise.all([
    db.communityPost.findMany({ where: { id: { in: postIds } }, include: { author, project: { select: { name: true } } } }),
    db.communityReply.findMany({ where: { id: { in: replyIds } }, include: { author, post: { select: { id: true, projectId: true, title: true, project: { select: { name: true } } } } } }),
  ]);
  const postById = new Map(posts.map((p) => [p.id, p]));
  const replyById = new Map(replies.map((r) => [r.id, r]));

  const groups = new Map<string, { targetType: "post" | "reply"; targetId: string; count: number; reasons: string[]; excerpt: string; hidden: boolean; author: { id: string; name: string }; project: string; link: string }>();
  for (const r of reports) {
    const key = `${r.targetType}:${r.targetId}`;
    const existing = groups.get(key);
    if (existing) {
      existing.count++;
      if (existing.reasons.length < 5) existing.reasons.push(r.reason);
      continue;
    }
    if (r.targetType === "post") {
      const p = postById.get(r.targetId);
      if (!p) continue; // Ziel inzwischen gelöscht
      groups.set(key, { targetType: "post", targetId: p.id, count: 1, reasons: [r.reason], excerpt: excerpt(`${p.title} – ${p.body}`), hidden: p.hidden, author: { id: p.author.id, name: displayNameOf(p.author) }, project: p.project.name, link: `/community/${p.projectId}/${p.id}` });
    } else {
      const reply = replyById.get(r.targetId);
      if (!reply) continue;
      groups.set(key, { targetType: "reply", targetId: reply.id, count: 1, reasons: [r.reason], excerpt: excerpt(reply.body), hidden: reply.hidden, author: { id: reply.author.id, name: displayNameOf(reply.author) }, project: reply.post.project.name, link: `/community/${reply.post.projectId}/${reply.post.id}#r-${reply.id}` });
    }
  }

  const banned = await db.user.findMany({
    where: { communityBannedAt: { not: null } },
    select: { id: true, username: true, displayName: true, communityBannedAt: true, communityBanReason: true },
    orderBy: { communityBannedAt: "desc" },
  });
  return json({
    off: false,
    reports: [...groups.values()],
    bans: banned.map((u) => ({ id: u.id, name: displayNameOf(u), username: u.username, since: u.communityBannedAt!.toISOString(), reason: u.communityBanReason })),
  });
});
