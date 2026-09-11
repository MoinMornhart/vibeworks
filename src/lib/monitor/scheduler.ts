import { runMonitorOnce } from "./run";

// Takt der Live-Überwachung.
// MONITOR_INTERVAL_MIN – Takt in Minuten (Standard 5)
// MONITOR_DISABLED=true – abschalten

const INTERVAL_MS = Math.max(1, Number(process.env.MONITOR_INTERVAL_MIN) || 5) * 60_000;

const g = globalThis as typeof globalThis & { __vwMonitor?: { timer?: ReturnType<typeof setInterval>; running: boolean } };

export function startMonitorScheduler() {
  if (process.env.MONITOR_DISABLED === "true") return;
  const state = (g.__vwMonitor ??= { running: false });
  if (state.timer) return;
  const tick = async () => {
    if (state.running) return;
    state.running = true;
    try {
      await runMonitorOnce();
    } catch (err) {
      console.error("[monitor]", err);
    } finally {
      state.running = false;
    }
  };
  state.timer = setInterval(() => void tick(), INTERVAL_MS);
  state.timer.unref?.();
  setTimeout(() => void tick(), 45_000).unref?.();
}
