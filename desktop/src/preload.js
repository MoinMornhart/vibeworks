// Preload für alle Fenster. Eigene Seiten (Einrichtung, offline) bekommen
// vwSetup, die Seiten des VibeWorks-Servers vibeworksDesktop – beides nur mit
// den nötigsten Aufrufen. Der Hauptprozess prüft zusätzlich, wer fragt.
const { contextBridge, ipcRenderer } = require("electron");

const arg = (name) => (process.argv.find((a) => a.startsWith(`--${name}=`)) ?? "").slice(name.length + 3);

if (location.protocol === "file:") {
  contextBridge.exposeInMainWorld("vwSetup", {
    connect: (url) => ipcRenderer.invoke("setup:connect", String(url ?? "")),
    retry: () => ipcRenderer.send("setup:retry"),
    change: () => ipcRenderer.send("setup:change"),
  });
} else {
  contextBridge.exposeInMainWorld("vibeworksDesktop", {
    version: arg("vw-version"),
    hideCapture: () => ipcRenderer.send("capture:hide"),
    openInMain: (path) => ipcRenderer.send("main:open", String(path ?? "")),
  });
}
