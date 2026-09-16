import { json, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guard";
import { requireTask } from "@/lib/access";
import { taskInfo } from "@/lib/taskInfo";

type Params = { id: string };

// Info-Fenster einer Aufgabe: Verlauf, KI-Schritte, Commits und Zeit – lesen darf, wer das Projekt sieht.
export const GET = route<Params>(async (_req, { params }) => {
  const user = await requireApiUser();
  const { task } = await requireTask(user.id, (await params).id);
  return json({ info: await taskInfo(task) });
});
