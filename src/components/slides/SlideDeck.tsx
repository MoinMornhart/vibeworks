"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Expand, GitBranch, GitCommitHorizontal, Globe, ListChecks, Minimize, X } from "lucide-react";
import type { ProjectStatus } from "@/generated/prisma/client";
import type { Slide } from "@/lib/slidesLogic";
import { PROJECT_ACCENTS, PROJECT_STATUS_MAP } from "@/lib/status";
import { Markdown } from "@/components/Markdown";
import { useFormat, useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

type Accent = { from: string; to: string };

function Heading({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-8 text-4xl font-bold tracking-tight sm:text-5xl">{children}</h2>;
}

function SlideView({ slide, accent }: { slide: Slide; accent: Accent }) {
  const t = useT("slides");
  const ts = useT("status");
  const f = useFormat();
  const gradientText = { backgroundImage: `linear-gradient(90deg, ${accent.from}, ${accent.to})`, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" } as const;

  switch (slide.kind) {
    case "title":
      return (
        <div className="text-center">
          {slide.cover && (
            // eslint-disable-next-line @next/next/no-img-element -- Vorschaubild aus dem eigenen Upload
            <img src={slide.cover} alt="" className="mx-auto mb-8 max-h-48 rounded-2xl shadow-2xl" />
          )}
          <h1 className="break-words text-5xl font-bold tracking-tight sm:text-7xl" style={gradientText}>{slide.title}</h1>
          {slide.summary && <p className="mx-auto mt-6 max-w-3xl text-2xl text-muted sm:text-3xl">{slide.summary}</p>}
          <p className="mt-8 text-lg text-muted">{t("by", { name: slide.owner })}</p>
          {slide.tags.length > 0 && (
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {slide.tags.map((tag) => (
                <span key={tag} className="chip text-base">#{tag}</span>
              ))}
            </div>
          )}
        </div>
      );
    case "section":
      return (
        <div>
          <Heading>{slide.title ?? t("about")}</Heading>
          <Markdown className="text-xl leading-relaxed sm:text-2xl">{slide.body}</Markdown>
        </div>
      );
    case "progress": {
      const status = PROJECT_STATUS_MAP[slide.status as ProjectStatus];
      const total = slide.tasks.todo + slide.tasks.doing + slide.tasks.blocked + slide.tasks.done;
      return (
        <div>
          <Heading>{t("progress")}</Heading>
          <div className="flex flex-wrap items-end gap-6">
            <span className="text-8xl font-bold tabular-nums leading-none" style={gradientText}>{slide.progress} %</span>
            {status && (
              <span className="chip mb-2 !px-3 !py-1 text-lg" style={{ color: `var(${status.cssVar})` }}>
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: `var(${status.cssVar})` }} /> {ts(`project.${slide.status as ProjectStatus}`)}
              </span>
            )}
          </div>
          <div className="mt-6 h-4 overflow-hidden rounded-full bg-fg/10">
            <div className="h-full rounded-full" style={{ width: `${slide.progress}%`, background: `linear-gradient(90deg, ${accent.from}, ${accent.to})` }} />
          </div>
          {total > 0 && (
            <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {(["todo", "doing", "blocked", "done"] as const).map((k) => (
                <div key={k} className="rounded-2xl border bg-bg/40 px-5 py-4">
                  <div className="text-4xl font-bold tabular-nums">{slide.tasks[k]}</div>
                  <div className="mt-1 text-muted">{t(`tasks.${k}`)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }
    case "commits":
      return (
        <div>
          <Heading>{t("commits")}</Heading>
          <ul className="space-y-5">
            {slide.commits.map((c, i) => (
              <li key={i} className="flex items-start gap-4">
                <GitCommitHorizontal size={28} className="mt-1 shrink-0 text-muted" />
                <span className="min-w-0">
                  <span className="block break-words text-2xl font-medium">{c.title}</span>
                  <span className="text-muted" suppressHydrationWarning>{c.author} · {f.ago(c.date)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      );
    case "live":
      return (
        <div className="text-center">
          <Heading>{t("live")}</Heading>
          {slide.cover && (
            // eslint-disable-next-line @next/next/no-img-element -- Vorschaubild aus dem eigenen Upload
            <img src={slide.cover} alt="" className="mx-auto mb-8 max-h-[45vh] rounded-2xl border shadow-2xl" />
          )}
          <a href={slide.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-3 break-all text-2xl text-accent-ink hover:underline sm:text-3xl">
            <Globe size={28} /> {slide.url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
          </a>
        </div>
      );
    case "next":
      return (
        <div>
          <Heading>{t("nextSteps")}</Heading>
          <ul className="space-y-4">
            {slide.tasks.map((task, i) => (
              <li key={i} className="flex items-start gap-4 text-2xl">
                <ListChecks size={28} className="mt-0.5 shrink-0 text-accent-ink" /> <span className="break-words">{task}</span>
              </li>
            ))}
          </ul>
        </div>
      );
    case "end":
      return (
        <div className="text-center">
          <h1 className="text-6xl font-bold tracking-tight sm:text-8xl" style={gradientText}>{t("thanks")}</h1>
          <p className="mt-6 text-2xl text-muted">{slide.title}</p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            {slide.liveUrl && (
              <a href={slide.liveUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary !px-5 !py-3 text-lg">
                <Globe size={20} /> {t("openLive")}
              </a>
            )}
            {slide.repoUrl && (
              <a href={slide.repoUrl} target="_blank" rel="noopener noreferrer" className="btn !px-5 !py-3 text-lg">
                <GitBranch size={20} /> {t("openCode")}
              </a>
            )}
          </div>
        </div>
      );
  }
}

/** Präsentation im Vollbild: Pfeiltasten, Leertaste, Klick oder Wischen blättern; F Vollbild; Esc zurück. */
export function SlideDeck({ projectId, slides, accent }: { projectId: string; slides: Slide[]; accent: string }) {
  const t = useT("slides");
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [full, setFull] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const touchX = useRef<number | null>(null);
  const a = PROJECT_ACCENTS[accent] ?? PROJECT_ACCENTS.violet;
  const last = slides.length - 1;

  const next = useCallback(() => setIndex((i) => Math.min(last, i + 1)), [last]);
  const prev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);
  const close = useCallback(() => router.push(`/projects/${projectId}`), [router, projectId]);
  const toggleFull = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void rootRef.current?.requestFullscreen?.().catch(() => undefined);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (["ArrowRight", "PageDown", " "].includes(e.key)) {
        e.preventDefault();
        next();
      } else if (["ArrowLeft", "PageUp"].includes(e.key)) {
        e.preventDefault();
        prev();
      } else if (e.key === "Home") setIndex(0);
      else if (e.key === "End") setIndex(last);
      else if (e.key === "Escape" && !document.fullscreenElement) close();
      else if (e.key === "f" || e.key === "F") toggleFull();
    };
    const onFullscreen = () => setFull(Boolean(document.fullscreenElement));
    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFullscreen);
    };
  }, [next, prev, close, toggleFull, last]);

  const slide = slides[index];
  const round = "rounded-lg p-2 text-muted transition hover:bg-fg/10 hover:text-fg disabled:opacity-30";

  return (
    <div
      ref={rootRef}
      role="region"
      aria-roledescription={t("deck")}
      aria-label={slides[0]?.kind === "title" ? slides[0].title : t("deck")}
      className="fixed inset-0 z-[60] flex flex-col bg-bg text-fg"
      style={{ backgroundImage: `radial-gradient(1100px 560px at 15% 5%, ${a.from}33, transparent), radial-gradient(900px 520px at 95% 95%, ${a.to}2b, transparent)` }}
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 50) (dx < 0 ? next : prev)();
        touchX.current = null;
      }}
    >
      <div className="flex items-center justify-between px-5 py-3 text-sm text-muted">
        <span className="tabular-nums" data-testid="slide-counter">{index + 1} / {slides.length}</span>
        <span className="hidden sm:inline">{t("hint")}</span>
        <div className="flex gap-1">
          <button type="button" className={round} onClick={toggleFull} aria-label={full ? t("exitFullscreen") : t("fullscreen")} title={full ? t("exitFullscreen") : t("fullscreen")}>
            {full ? <Minimize size={18} /> : <Expand size={18} />}
          </button>
          <button type="button" className={round} onClick={close} aria-label={t("close")} title={t("close")}>
            <X size={18} />
          </button>
        </div>
      </div>

      <div
        className="flex flex-1 items-center justify-center overflow-y-auto px-6 pb-4 sm:px-16"
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("a,button")) return;
          const box = e.currentTarget.getBoundingClientRect();
          (e.clientX - box.left > box.width / 3 ? next : prev)();
        }}
      >
        <div key={index} className="fade-in w-full max-w-5xl py-6" aria-live="polite" data-testid="slide" data-kind={slide.kind}>
          <SlideView slide={slide} accent={a} />
        </div>
      </div>

      <div className="flex items-center justify-center gap-3 pb-5">
        <button type="button" className={round} onClick={prev} disabled={index === 0} aria-label={t("prev")}>
          <ChevronLeft size={22} />
        </button>
        <div className="flex flex-wrap items-center justify-center gap-1.5" data-testid="slide-dots">
          {slides.map((s, i) => (
            <button
              key={i}
              type="button"
              aria-label={t("goTo", { n: i + 1 })}
              aria-current={i === index ? "step" : undefined}
              onClick={() => setIndex(i)}
              className={cn("h-2 rounded-full transition-all", i === index ? "w-6" : "w-2 bg-fg/25 hover:bg-fg/50")}
              style={i === index ? { background: `linear-gradient(90deg, ${a.from}, ${a.to})` } : undefined}
            />
          ))}
        </div>
        <button type="button" className={round} onClick={next} disabled={index === last} aria-label={t("next")}>
          <ChevronRight size={22} />
        </button>
      </div>
    </div>
  );
}
