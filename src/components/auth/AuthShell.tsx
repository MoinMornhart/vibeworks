import type { ReactNode } from "react";
import { Logo } from "@/components/Logo";
import { config } from "@/lib/config";
import { LanguageSwitch } from "@/components/LanguageSwitch";

export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="fade-in w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo size={56} />
          <p className="gradient-text mt-3 text-3xl font-bold tracking-tight">{config.appName}</p>
        </div>
        <section className="glass p-6 sm:p-8">
          <h1 className="text-xl font-semibold">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </section>
        <div className="mt-4 flex justify-center">
          <LanguageSwitch />
        </div>
      </div>
    </main>
  );
}
