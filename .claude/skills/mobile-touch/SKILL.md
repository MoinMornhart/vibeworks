# Skill: Mobile Touch & Vollbild (Code-Graph und canvas-/SVG-Panels)

## Wann laden?
Wenn Touch-Gesten (Pinch-Zoom, Drag, Vollbild) auf Handys nicht funktionieren
oder ein Panel neu gebaut wird, das Pan/Zoom hat.

## Die vier Regeln (aus echten Fehlern gelernt)

1. **Niemals React-Pointer-Handler für Pinch nehmen.** Sie sind passiv –
   `preventDefault()` greift nicht, der Browser-Seitenzoom übernimmt die Geste.
   Immer native Listener mit `{ passive: false }`:
   `touchstart`/`touchmove` mit `passive: false`, `touchend`/`touchcancel` normal.

2. **Gesten-Basis nie aus dem Effect-Verschluss lesen.** `view.k` im Closure
   ist der Stand beim Mounten. Nach dem ersten „Einpassen“ stimmt er nicht mehr
   → der Zoom rechnet mit alten Werten und das Netz „fällt zusammen“.
   Lösung: `const viewRef = useRef(view); viewRef.current = view;` und beim
   `touchstart` die Basis aus `viewRef.current` nehmen.

3. **`touch-action: none` (Tailwind: `touch-none`) auf dem SVG-Element setzen**,
   sonst kämpft der Browser-Pinch zusätzlich mit der eigenen Geste.

4. **Vollbild mit Fallback:** `requestFullscreen()` gibt es auf iOS-Safari nicht –
   dort `webkitRequestFullscreen` (Element) bzw. `webkitExitFullscreen` (document)
   rufen. Fehlschlag still abfangen (`.catch(() => {})`), die Overlay-Ansicht
   mit `h-dvh` bleibt dann die Fallback-Erfahrung. Über
   `fullscreenchange` auf externes Beenden (Zurück-Taste) reagieren.

## Referenz-Implementierung
`src/components/git/CodeGraphPanel.tsx` – Abschnitte „Mausrad zoomt das Netz…“
(Touch-Listener) und „Vollbild: Esc schließt…“ (Fullscreen-API mit Fallback).

## Testen ohne Handy
`tsc`, `vitest`, `build` müssen grün sein; echtes Touch-Verhalten prüft nur der
Nutzer auf dem Gerät – das im Abschlussbericht offen nennen, nie als „getestet“
behaupten.
