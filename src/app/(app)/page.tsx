import { displayNameOf, requirePageUser } from "@/lib/auth/guard";

export default async function Dashboard() {
  const user = await requirePageUser();
  return (
    <section className="glass fade-in p-8">
      <h1 className="text-3xl font-bold tracking-tight">
        Hallo, <span className="gradient-text">{displayNameOf(user)}</span>
      </h1>
      <p className="mt-2 text-muted">Hier entsteht dein Projekt-Dashboard.</p>
    </section>
  );
}
