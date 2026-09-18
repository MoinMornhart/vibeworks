"use client";

import { useEffect, useState } from "react";

// Sparmodus (#mobil): Auf Handys (Touch + Android) drosseln, was Strom und
// Flüssigkeit kostet – Canvas-Hintergrund stilllegen, Netz-Simulation seltener
// rechnen. Erkennung: grob nach Geräteklasse, ohne Nutzerdaten zu senden.
//
// Der Nutzer kann das umgehen, indem er im Design die Geschwindigkeit auf 0
// stellt – der Sparmodus fasst das nur zusammen und greift auch, wenn er es
// vergessen hat. Auf Desktop passiert nichts.

let cached: boolean | null = null;

/** Handy erkannt? Touch primär + schmaler Bildschirm oder Android-Kennung. */
function detect(): boolean {
  if (typeof window === "undefined") return false;
  if (cached !== null) return cached;
  const touch = window.matchMedia("(pointer: coarse)").matches;
  const narrow = window.matchMedia("(max-width: 820px)").matches;
  const android = /Android/i.test(navigator.userAgent);
  cached = (touch && narrow) || android;
  return cached;
}

export function useSaverMode(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    setOn(detect());
    const mq = window.matchMedia("(pointer: coarse)");
    const onMq = () => {
      cached = null;
      setOn(detect());
    };
    mq.addEventListener("change", onMq);
    return () => mq.removeEventListener("change", onMq);
  }, []);
  return on;
}

/** Anteil der Bilder, die im Sparmodus noch gerechnet werden (Netz-Simulation). */
export const SAVER_FRAME_SKIP = 3;
