// Brücke zur Windows-App (desktop/src/preload.js). In der App stellt das
// Preload-Skript window.vibeworksDesktop bereit, im Browser fehlt es.

export interface DesktopBridge {
  version: string;
  /** Schnellerfassung ausblenden */
  hideCapture(): void;
  /** Pfad der eigenen Seite im Hauptfenster öffnen, z. B. "/projects/abc" */
  openInMain(path: string): void;
}

declare global {
  interface Window {
    vibeworksDesktop?: DesktopBridge;
  }
}

export const desktopBridge = (): DesktopBridge | undefined => (typeof window === "undefined" ? undefined : window.vibeworksDesktop);

/** Die Windows-App ruft das beim Einblenden der Schnellerfassung aus. */
export const CAPTURE_SHOW_EVENT = "vw:capture-show";
