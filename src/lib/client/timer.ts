"use client";

import { useEffect, useState } from "react";
import { api } from "./api";

// Laufender Timer für die ganze Oberfläche: ein gemeinsamer Stand, den die
// Anzeige oben und die Start-Knöpfe an den Aufgaben teilen.

export interface RunningTimer {
  id: string;
  startedAt: string;
  focusMinutes: number | null;
  task: { id: string; title: string } | null;
  project: { id: string; name: string };
}

let current: RunningTimer | null = null;
let loaded = false;
const listeners = new Set<(t: RunningTimer | null) => void>();
const publish = (t: RunningTimer | null) => {
  current = t;
  loaded = true;
  for (const l of listeners) l(t);
};

export async function refreshTimer() {
  const res = await api<{ current: RunningTimer | null }>("/api/time").catch(() => null);
  if (res) publish(res.current);
}

export async function startTimer(taskId: string, focusMinutes?: number) {
  const res = await api<{ current: RunningTimer | null }>("/api/time/start", { body: { taskId, focusMinutes: focusMinutes ?? null } });
  publish(res.current);
}

export async function stopTimer(): Promise<number | null> {
  const res = await api<{ stopped: { seconds: number } | null }>("/api/time/stop", { body: {} });
  publish(null);
  return res.stopped?.seconds ?? null;
}

export function useTimer(): RunningTimer | null {
  const [state, setState] = useState<RunningTimer | null>(current);
  useEffect(() => {
    listeners.add(setState);
    if (!loaded) void refreshTimer();
    else setState(current);
    return () => {
      listeners.delete(setState);
    };
  }, []);
  return state;
}

/** Sekunden-Takt für Anzeigen, die mitlaufen. */
export function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}
