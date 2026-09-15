import { db } from "@/lib/db";
import { json, route } from "@/lib/api";
import { displayNameOf, requireApiAdmin } from "@/lib/auth/guard";
import { communityOn } from "@/lib/community";
import { excerpt } from "@/lib/communityLogic";

type TargetType = "post" | "reply" | "message";
interface Group {
  targetType: TargetType;
  targetId: string;
  count: number;
  reasons: string[];
  excerpt: string;
  hidden: boolean;
  author: { id: string; name: string };
  /** Projektname – leer bei der Lobby */
  project: string;
  link: string;
}

// Admin-Übersicht: offene Meldungen (je Ziel zusammengefasst) und instanzweit gesperrte Konten.
export const GET = route(async () => {
  await requireApiAdmin();
  if (!(await communityOn())) return json({ off: true, reports: [], bans: [] });

  const reports = await db.communityReport.findMany({ where: { status: "open" }, orderBy: { createdAt: "desc" }, take: 300 });
  const idsOf = (type: TargetType) => [...new Set(reports.filter((r) => r.targetType === type).map((r) => r.targetId))];
  const author = { select: { id: true, username: true, displayName: true } } as const;
  const [posts, replies, messages] = await Promise.all([
    db.communityPost.findMany({ where: { id: { in: idsOf("post") } }, include: { author, project: { select: { name: true } } } }),
    db.communityReply.findMany({ where: { id: { in: idsOf("reply") } }, include: { author, post: { select: { id: true, projectId: true, project: { select: { name: true } } } } } }),
    db.communityMessage.findMany({ where: { id: { in: idsOf("message") } }, include: { author, project: { select: { name: true } } } }),
  ]);

  const describe = new Map<string, Omit<Group, "count" | "reasons">>();
  for (const p of posts) {
    describe.set(`post:${p.id}`, { targetType: "post", targetId: p.id, excerpt: excerpt(`${p.title} – ${p.body}`), hidden: p.hidden, author: { id: p.author.id, name: displayNameOf(p.author) }, project: p.project.name, link: `/community/${p.projectId}/${p.id}` });
  }
  for (const r of replies) {
    describe.set(`reply:${r.id}`, { targetType: "reply", targetId: r.id, excerpt: excerpt(r.body), hidden: r.hidden, author: { id: r.author.id, name: displayNameOf(r.author) }, project: r.post.project.name, link: `/community/${r.post.projectId}/${r.post.id}#r-${r.id}` });
  }
  for (const m of messages) {
    describe.set(`message:${m.id}`, { targetType: "message", targetId: m.id, excerpt: excerpt(m.body), hidden: m.hidden, author: { id: m.author.id, name: displayNameOf(m.author) }, project: m.project?.name ?? "", link: m.projectId ? `/community/${m.projectId}#chat` : "/community#chat" });
  }

  const groups = new Map<string, Group>();
  for (const r of reports) {
    const key = `${r.targetType}:${r.targetId}`;
    const existing = groups.get(key);
    if (existing) {
      existing.count++;
      if (existing.reasons.length < 5) existing.reasons.push(r.reason);
      continue;
    }
    const d = describe.get(key);
    if (d) groups.set(key, { ...d, count: 1, reasons: [r.reason] }); // gelöschte Ziele fallen weg
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
