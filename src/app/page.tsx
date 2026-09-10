import { config } from "@/lib/config";
import { CURRENT_VERSION } from "@/lib/changelog";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col items-center justify-center px-4 py-16 text-center">
      <div className="glass fade-in w-full p-10">
        <h1 className="gradient-text text-5xl font-bold tracking-tight">{config.appName}</h1>
        <p className="mt-4 text-muted">Das Kontrollzentrum für deine Vibe-Coding-Projekte.</p>
        <p className="mt-8 text-xs text-muted">Version {CURRENT_VERSION}</p>
      </div>
    </main>
  );
}
