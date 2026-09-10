"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { luminance } from "@/lib/theme/color";
import { presetColors, type Theme } from "@/lib/theme";
import { CANVAS_ENGINES, type CanvasPreset } from "./engines";
import { useTheme } from "@/components/theme/ThemeProvider";
import { cn } from "@/lib/utils";

// Der Hintergrund hinter allen Seiten. Drei Arten: animierte Vorlage,
// eigener Farbverlauf oder eigenes Bild. Liest das aktive Design (inklusive
// Live-Vorschau aus dem Editor) aus dem ThemeProvider. Mit `contained`
// rendert er in einen beliebigen Kasten – für die Vorschaubilder im Editor.

function useMedia(query: string): boolean {
  const [match, setMatch] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    setMatch(mq.matches);
    const on = (e: MediaQueryListEvent) => setMatch(e.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return match;
}

function useIsDark(theme: Theme): boolean {
  const systemLight = useMedia("(prefers-color-scheme: light)");
  const mode = theme.mode === "system" ? (systemLight ? "light" : "dark") : theme.mode;
  return luminance((mode === "light" ? theme.light : theme.dark).bg) < 0.4;
}

function CanvasLayer({ preset, theme, dark, still }: { preset: CanvasPreset; theme: Theme; dark: boolean; still: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const colors = presetColors(theme);
  const { speed, intensity } = theme.background.preset;
  const key = `${preset}|${colors.join()}|${speed}|${intensity}|${dark}|${still}`;

  useEffect(() => {
    const canvas = ref.current;
    const host = canvas?.parentElement;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !host || !ctx) return;
    const velocity = still ? 0 : speed / 100;
    const engine = CANVAS_ENGINES[preset](ctx, { colors, speed: velocity, intensity: intensity / 100, dark });

    let raf = 0;
    let last = performance.now();
    let rect = host.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      rect = host.getBoundingClientRect();
      const w = Math.max(1, rect.width), h = Math.max(1, rect.height);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      engine.resize(w, h);
      engine.frame(0.016, last / 1000);
    };
    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      engine.frame(dt, now / 1000);
      raf = requestAnimationFrame(loop);
    };
    const run = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden && velocity > 0) {
        last = performance.now();
        raf = requestAnimationFrame(loop);
      }
    };
    const onPointer = (e: PointerEvent) => engine.pointer?.(e.clientX - rect.left, e.clientY - rect.top);

    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();
    window.addEventListener("pointermove", onPointer, { passive: true });
    document.addEventListener("visibilitychange", run);
    run();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("pointermove", onPointer);
      document.removeEventListener("visibilitychange", run);
    };
    // `key` fasst alle Abhängigkeiten zusammen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return <canvas ref={ref} aria-hidden />;
}

export function gradientCss(g: Theme["background"]["gradient"]): string {
  const stops = [...g.stops].sort((a, b) => a.pos - b.pos).map((s) => `${s.color} ${s.pos}%`).join(", ");
  if (g.kind === "radial") return `radial-gradient(circle at 50% 40%, ${stops})`;
  if (g.kind === "conic") return `conic-gradient(from ${g.angle}deg at 50% 50%, ${stops}, ${g.stops[0].color})`;
  return `linear-gradient(${g.angle}deg, ${stops})`;
}

export function BackgroundView({ theme, contained = false, still = false }: { theme: Theme; contained?: boolean; still?: boolean }) {
  const dark = useIsDark(theme);
  const reduced = useMedia("(prefers-reduced-motion: reduce)");
  const bg = theme.background;
  const frozen = still || reduced;
  const style = {
    "--vw-speed": Math.max((bg.type === "gradient" ? bg.gradient.speed : bg.preset.speed) / 100, 0.01),
  } as CSSProperties;
  const paused = frozen || (bg.type === "preset" ? bg.preset.speed === 0 : bg.type === "gradient" ? !bg.gradient.animate : true);
  const opacity = bg.preset.intensity / 100;

  let layer: React.ReactNode = null;
  if (bg.type === "preset") {
    const id = bg.preset.id;
    if (id in CANVAS_ENGINES) {
      layer = (
        <div style={{ opacity: Math.min(1, opacity + 0.25) }}>
          <CanvasLayer preset={id as CanvasPreset} theme={theme} dark={dark} still={frozen} />
        </div>
      );
    } else if (id === "nebula") {
      layer = <div className="vw-nebula" style={{ opacity: dark ? opacity : opacity * 0.7 }}><span /><span /><span /></div>;
    } else if (id === "aurora") {
      layer = <div className="vw-aurora" style={{ opacity: dark ? opacity : opacity * 0.65 }}><span /><span /><span /></div>;
    } else if (id === "mesh") {
      layer = <div className="vw-mesh" style={{ opacity: dark ? opacity * 0.85 : opacity * 0.6 }} />;
    } else if (id === "synthwave") {
      layer = <div className="vw-synthwave" style={{ opacity }}><div className="sun" /><div className="grid" /></div>;
    }
  } else if (bg.type === "gradient") {
    const g = bg.gradient;
    layer = <div className={`vw-gradient is-${g.kind}${g.animate ? " is-animated" : ""}`} style={{ backgroundImage: gradientCss(g) }} />;
  } else if (bg.type === "image" && bg.image.uploadId) {
    const img = bg.image;
    layer = (
      <>
        <div
          style={{
            backgroundImage: `url(/api/uploads/${encodeURIComponent(img.uploadId!)})`,
            backgroundSize: img.fit === "tile" ? "auto" : img.fit,
            backgroundRepeat: img.fit === "tile" ? "repeat" : "no-repeat",
            backgroundPosition: img.position,
            filter: img.blur ? `blur(${img.blur}px)` : undefined,
            inset: img.blur ? `-${img.blur * 2}px` : 0,
          }}
        />
        <div style={{ background: "var(--vw-bg)", opacity: img.dim / 100 }} />
      </>
    );
  }

  return (
    <div className={cn("vw-bg", contained && "is-contained", paused && "vw-paused")} style={style} aria-hidden>
      {layer}
      {bg.grain && <div className="vw-grain" />}
    </div>
  );
}

export function Background() {
  const { theme } = useTheme();
  return <BackgroundView theme={theme} />;
}
