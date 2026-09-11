"use client";

import { useEffect, useState } from "react";
import { X, Zap } from "lucide-react";
import { CaptureForm } from "@/components/QuickCapture";
import { CAPTURE_SHOW_EVENT, desktopBridge } from "@/lib/desktop";
import { useT } from "@/lib/i18n/client";

// Rahmenloses Fenster der Windows-App: die Kopfzeile dient als Griff zum Verschieben.
const drag = { WebkitAppRegion: "drag" } as React.CSSProperties;
const noDrag = { WebkitAppRegion: "no-drag" } as React.CSSProperties;

/** Schnellerfassung als eigene Seite (/capture) – für das kleine Fenster der Windows-App. */
export function CapturePanel() {
  const t = useT("shell");
  const [reloadKey, setReloadKey] = useState(0);
  const [inApp, setInApp] = useState(false);

  function close() {
    const bridge = desktopBridge();
    if (bridge) bridge.hideCapture();
    else window.location.href = "/";
  }

  // In der App: Links im Hauptfenster öffnen und die Schnellerfassung ausblenden
  function openLink(href: string, e: React.MouseEvent) {
    const bridge = desktopBridge();
    if (!bridge) return;
    e.preventDefault();
    bridge.openInMain(href);
    bridge.hideCapture();
  }

  useEffect(() => {
    setInApp(Boolean(desktopBridge()));
    const onShow = () => setReloadKey((k) => k + 1);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener(CAPTURE_SHOW_EVENT, onShow);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(CAPTURE_SHOW_EVENT, onShow);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div className="glass-strong fade-in w-full max-w-lg rounded-2xl">
      <div className="flex items-center justify-between gap-4 border-b px-5 py-3" style={drag}>
        <h1 className="flex items-center gap-2 text-lg font-semibold">
          <Zap size={18} className="text-accent-ink" /> {t("capture.title")}
        </h1>
        <button type="button" className="btn btn-ghost btn-icon" style={noDrag} onClick={close} aria-label={t("capture.close")}>
          <X size={18} />
        </button>
      </div>
      <div className="px-5 py-4" style={noDrag}>
        <CaptureForm active reloadKey={reloadKey} hint={inApp ? t("capture.desktopHint") : undefined} onLinkClick={openLink} />
      </div>
    </div>
  );
}
