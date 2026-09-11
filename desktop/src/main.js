// VibeWorks für Windows – Hauptprozess.
//   Hauptfenster: lädt den eigenen VibeWorks-Server (Anmeldung wie im Browser)
//   Tray: öffnen, Schnellerfassung, Einstellungen, Updates, Beenden
//   Schnellerfassung: kleines Fenster mit /capture, globales Tastenkürzel
//   Benachrichtigungen: holt jede Minute /api/notifications ab → Windows-Meldung
//   Updates: electron-updater aus dem GitHub-Release „desktop-latest“
const { app, BrowserWindow, Menu, Notification, Tray, dialog, globalShortcut, ipcMain, nativeImage, screen, session, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs");

const APP_ID = "de.moinmornhart.vibeworks";
const POLL_MS = 60_000;
const TEST = process.env.VIBEWORKS_TEST === "1";
if (process.env.VIBEWORKS_USER_DATA) app.setPath("userData", process.env.VIBEWORKS_USER_DATA);

// ── Texte ────────────────────────────────────────────────────
const TEXT = {
  de: {
    open: "VibeWorks öffnen",
    capture: "Schnell erfassen",
    notifications: "Windows-Benachrichtigungen",
    keepInTray: "Beim Schließen im Tray bleiben",
    checkUpdates: "Nach Updates suchen",
    changeServer: "Server-Adresse ändern …",
    version: "Version",
    quit: "Beenden",
    trayHintTitle: "VibeWorks läuft weiter",
    trayHint: "Die App bleibt im Tray neben der Uhr – für die Schnellerfassung ({key}) und Benachrichtigungen.",
    hotkeyTakenTitle: "Tastenkürzel belegt",
    hotkeyTaken: "{key} benutzt schon ein anderes Programm. Die Schnellerfassung geht weiter über das Tray-Symbol.",
    updateReady: "VibeWorks {v} ist bereit.",
    updateDetail: "Jetzt neu starten und installieren? Sonst wird das Update beim nächsten Beenden installiert.",
    restartNow: "Jetzt neu starten",
    later: "Später",
    upToDate: "Du hast die neueste Version ({v}).",
    updateLoading: "Update {v} wird geladen …",
    updateFailed: "Update-Prüfung fehlgeschlagen: {msg}",
    notVibeworks: "Unter dieser Adresse antwortet kein VibeWorks-Server.",
    unreachable: "Server nicht erreichbar ({msg}).",
    invalidUrl: "Das ist keine gültige Adresse.",
    ctrl: "Strg",
  },
  en: {
    open: "Open VibeWorks",
    capture: "Quick capture",
    notifications: "Windows notifications",
    keepInTray: "Keep running in the tray when closed",
    checkUpdates: "Check for updates",
    changeServer: "Change server address …",
    version: "Version",
    quit: "Quit",
    trayHintTitle: "VibeWorks keeps running",
    trayHint: "The app stays in the tray next to the clock – for quick capture ({key}) and notifications.",
    hotkeyTakenTitle: "Shortcut in use",
    hotkeyTaken: "{key} is already used by another program. Quick capture still works from the tray icon.",
    updateReady: "VibeWorks {v} is ready.",
    updateDetail: "Restart now to install it? Otherwise the update is installed the next time you quit.",
    restartNow: "Restart now",
    later: "Later",
    upToDate: "You have the latest version ({v}).",
    updateLoading: "Downloading update {v} …",
    updateFailed: "Update check failed: {msg}",
    notVibeworks: "There is no VibeWorks server at this address.",
    unreachable: "Server not reachable ({msg}).",
    invalidUrl: "That is not a valid address.",
    ctrl: "Ctrl",
  },
};
let lang = "de";
const L = (key, vars = {}) => TEXT[lang][key].replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));

// ── Einstellungen ────────────────────────────────────────────
const DEFAULTS = { serverUrl: null, notifications: true, keepInTray: true, hotkey: "CommandOrControl+Alt+V", cursor: null, bounds: null, maximized: false, trayHintShown: false };
let cfg = { ...DEFAULTS };
const configFile = () => path.join(app.getPath("userData"), "config.json");
function loadConfig() {
  try {
    cfg = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(configFile(), "utf8")) };
  } catch {
    cfg = { ...DEFAULTS };
  }
}
function saveConfig() {
  try {
    fs.mkdirSync(path.dirname(configFile()), { recursive: true });
    fs.writeFileSync(configFile(), JSON.stringify(cfg, null, 2));
  } catch (err) {
    console.error("[config]", err);
  }
}

const asset = (name) => path.join(__dirname, "..", "assets", name);
const hotkeyLabel = () => cfg.hotkey.replace("CommandOrControl", L("ctrl"));
const isOwn = (url) => {
  try {
    return Boolean(cfg.serverUrl) && new URL(url).origin === new URL(cfg.serverUrl).origin;
  } catch {
    return false;
  }
};

let mainWin = null;
let captureWin = null;
let setupWin = null;
let tray = null;
let quitting = false;
const shown = []; // nur im Testbetrieb: gezeigte Meldungen
const liveToasts = new Set(); // Referenzen halten, sonst verpufft der Klick

const webPrefs = () => ({
  preload: path.join(__dirname, "preload.js"),
  contextIsolation: true,
  sandbox: true,
  nodeIntegration: false,
  spellcheck: true,
  additionalArguments: [`--vw-version=${app.getVersion()}`],
});

// ── Server-Adresse ───────────────────────────────────────────
function candidates(input) {
  const raw = String(input || "").trim().replace(/\/+$/, "");
  if (!raw) return [];
  const list = /^https?:\/\//i.test(raw) ? [raw] : [`https://${raw}`, `http://${raw}`];
  return list.flatMap((s) => {
    try {
      const u = new URL(s);
      return u.protocol === "https:" || u.protocol === "http:" ? [u.origin] : [];
    } catch {
      return [];
    }
  });
}

async function checkServer(origin) {
  const res = await session.defaultSession.fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(8000) });
  const data = await res.json().catch(() => null);
  if (!data || typeof data.version !== "string") throw new Error(L("notVibeworks"));
  return data.version;
}

// ── Fenster ──────────────────────────────────────────────────
function guard(wc) {
  wc.setWindowOpenHandler(({ url }) => {
    if (isOwn(url)) showMain(url);
    else if (/^https?:/i.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  wc.on("will-navigate", (e, url) => {
    if (isOwn(url) || url.startsWith("file:")) return;
    e.preventDefault();
    if (/^https?:/i.test(url)) void shell.openExternal(url);
  });
  // Ohne Menüleiste: die üblichen Tasten selbst belegen
  wc.on("before-input-event", (e, input) => {
    if (input.type !== "keyDown") return;
    const ctrl = input.control || input.meta;
    const key = input.key;
    if (key === "F5" || (ctrl && key.toLowerCase() === "r")) wc.reload();
    else if (ctrl && input.shift && key.toLowerCase() === "i") wc.toggleDevTools();
    else if (input.alt && key === "ArrowLeft" && wc.navigationHistory.canGoBack()) wc.navigationHistory.goBack();
    else if (input.alt && key === "ArrowRight" && wc.navigationHistory.canGoForward()) wc.navigationHistory.goForward();
    else if (ctrl && (key === "+" || key === "=")) wc.setZoomLevel(Math.min(wc.getZoomLevel() + 0.5, 4));
    else if (ctrl && key === "-") wc.setZoomLevel(Math.max(wc.getZoomLevel() - 0.5, -3));
    else if (ctrl && key === "0") wc.setZoomLevel(0);
    else return;
    e.preventDefault();
  });
}

function saveBounds() {
  if (!mainWin || mainWin.isDestroyed()) return;
  cfg.maximized = mainWin.isMaximized();
  cfg.bounds = mainWin.getNormalBounds();
  saveConfig();
}

function showOffline() {
  if (!mainWin || mainWin.isDestroyed()) return;
  void mainWin.loadFile(path.join(__dirname, "setup.html"), { query: { mode: "offline", lang, server: cfg.serverUrl ?? "" } });
}

function createMain() {
  const bounds = cfg.bounds ?? { width: 1400, height: 900 };
  mainWin = new BrowserWindow({
    ...bounds,
    minWidth: 420,
    minHeight: 480,
    show: false,
    title: "VibeWorks",
    backgroundColor: "#06061a",
    icon: asset("icon.png"),
    autoHideMenuBar: true,
    webPreferences: webPrefs(),
  });
  guard(mainWin.webContents);
  mainWin.once("ready-to-show", () => {
    if (cfg.maximized) mainWin.maximize();
    if (!process.argv.includes("--hidden")) mainWin.show();
  });
  mainWin.on("close", (e) => {
    saveBounds();
    if (quitting) return;
    if (!cfg.keepInTray) {
      quitting = true;
      app.quit();
      return;
    }
    e.preventDefault();
    mainWin.hide();
    if (!cfg.trayHintShown) {
      toast(L("trayHintTitle"), L("trayHint", { key: hotkeyLabel() }));
      cfg.trayHintShown = true;
      saveConfig();
    }
  });
  mainWin.webContents.on("did-fail-load", (_e, code, _desc, url, isMainFrame) => {
    // -3 = abgebrochen (z. B. schnelle Weiterleitung) – kein Grund für die Offline-Seite
    if (isMainFrame && code !== -3 && isOwn(url)) showOffline();
  });
  // Nach dem Anmelden sofort den Posteingang abholen
  mainWin.webContents.on("did-finish-load", () => void poll());
  void mainWin.loadURL(cfg.serverUrl);
}

function showMain(url) {
  if (!cfg.serverUrl) return openSetup();
  if (!mainWin || mainWin.isDestroyed()) createMain();
  if (url && isOwn(url)) void mainWin.loadURL(url);
  if (mainWin.isMinimized()) mainWin.restore();
  mainWin.show();
  mainWin.focus();
}

function createCapture() {
  captureWin = new BrowserWindow({
    width: 560,
    height: 460,
    show: false,
    frame: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    title: "VibeWorks",
    backgroundColor: "#06061a",
    icon: asset("icon.png"),
    webPreferences: webPrefs(),
  });
  guard(captureWin.webContents);
  captureWin.on("blur", () => {
    if (!TEST && captureWin.isVisible()) captureWin.hide();
  });
  captureWin.on("close", (e) => {
    if (quitting) return;
    e.preventDefault();
    captureWin.hide();
  });
  // Abgemeldet? Dann gehört die Anmeldung ins Hauptfenster.
  captureWin.webContents.on("did-navigate", (_e, url) => {
    if (isOwn(url) && new URL(url).pathname.startsWith("/login")) {
      captureWin.hide();
      showMain();
    }
  });
  void captureWin.loadURL(`${cfg.serverUrl}/capture`);
}

function showCapture() {
  if (!cfg.serverUrl) return openSetup();
  if (!captureWin || captureWin.isDestroyed()) createCapture();
  else if (!captureWin.webContents.getURL().startsWith(`${cfg.serverUrl}/capture`)) void captureWin.loadURL(`${cfg.serverUrl}/capture`);
  const { x, y, width, height } = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
  const [w] = captureWin.getSize();
  captureWin.setPosition(Math.round(x + (width - w) / 2), Math.round(y + height * 0.2));
  captureWin.show();
  captureWin.focus();
  captureWin.webContents.executeJavaScript('window.dispatchEvent(new Event("vw:capture-show"))').catch(() => {});
}

function toggleCapture() {
  if (captureWin && !captureWin.isDestroyed() && captureWin.isVisible() && captureWin.isFocused()) captureWin.hide();
  else showCapture();
}

function openSetup(mode = "setup") {
  if (setupWin && !setupWin.isDestroyed()) return setupWin.focus();
  setupWin = new BrowserWindow({
    width: 520,
    height: 600,
    resizable: false,
    maximizable: false,
    title: "VibeWorks",
    backgroundColor: "#06061a",
    icon: asset("icon.png"),
    autoHideMenuBar: true,
    webPreferences: webPrefs(),
  });
  guard(setupWin.webContents);
  void setupWin.loadFile(path.join(__dirname, "setup.html"), { query: { mode, lang, server: cfg.serverUrl ?? "" } });
  setupWin.on("closed", () => {
    setupWin = null;
    if (!cfg.serverUrl && !quitting) app.quit();
  });
}

// ── Tray & Tastenkürzel ──────────────────────────────────────
function buildTray() {
  if (!tray) {
    tray = new Tray(nativeImage.createFromPath(asset("tray.png")));
    tray.setToolTip("VibeWorks");
    tray.on("click", () => showMain());
  }
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: L("open"), click: () => showMain() },
      { label: L("capture"), accelerator: cfg.hotkey, registerAccelerator: false, click: () => showCapture() },
      { type: "separator" },
      {
        label: L("notifications"),
        type: "checkbox",
        checked: cfg.notifications,
        click: (item) => {
          cfg.notifications = item.checked;
          saveConfig();
        },
      },
      {
        label: L("keepInTray"),
        type: "checkbox",
        checked: cfg.keepInTray,
        click: (item) => {
          cfg.keepInTray = item.checked;
          saveConfig();
        },
      },
      { label: L("checkUpdates"), enabled: app.isPackaged, click: () => void checkUpdates(true) },
      { label: L("changeServer"), click: () => openSetup() },
      { type: "separator" },
      { label: `${L("version")} ${app.getVersion()}`, enabled: false },
      {
        label: L("quit"),
        click: () => {
          quitting = true;
          app.quit();
        },
      },
    ]),
  );
}

function registerHotkey() {
  globalShortcut.unregisterAll();
  if (!globalShortcut.register(cfg.hotkey, toggleCapture)) toast(L("hotkeyTakenTitle"), L("hotkeyTaken", { key: hotkeyLabel() }));
}

// ── Benachrichtigungen ───────────────────────────────────────
function toast(title, body, url) {
  if (TEST) shown.push({ title, body, url: url ?? null });
  if (!Notification.isSupported()) return;
  const n = new Notification({ title, body: body.length > 240 ? `${body.slice(0, 237)}…` : body, icon: asset("icon.png") });
  liveToasts.add(n);
  const drop = () => liveToasts.delete(n);
  n.on("click", () => {
    drop();
    showMain(url && isOwn(url) ? url : undefined);
  });
  n.on("close", drop);
  n.show();
}

let polling = false;
async function poll() {
  if (!cfg.serverUrl || polling) return;
  polling = true;
  try {
    const url = new URL("/api/notifications", cfg.serverUrl);
    if (cfg.cursor) url.searchParams.set("after", cfg.cursor);
    const res = await session.defaultSession.fetch(url.toString(), {
      credentials: "include",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return; // nicht angemeldet oder Server gerade weg
    const data = await res.json();
    if (!cfg.cursor) {
      // Erster Abruf: ab jetzt zählen, keine alten Meldungen nachholen
      cfg.cursor = data.now;
      saveConfig();
      return;
    }
    for (const item of data.items ?? []) {
      if (cfg.notifications) toast(item.title, item.message, item.url);
      cfg.cursor = item.createdAt;
    }
    if (data.items?.length) saveConfig();
  } catch {
    /* offline – beim nächsten Mal */
  } finally {
    polling = false;
  }
}

// ── Updates ──────────────────────────────────────────────────
let updater = null;
function setupUpdater() {
  if (!app.isPackaged) return;
  updater = require("electron-updater").autoUpdater;
  updater.autoDownload = true;
  updater.autoInstallOnAppQuit = true;
  updater.on("update-downloaded", async (info) => {
    const { response } = await dialog.showMessageBox({
      type: "info",
      title: "VibeWorks",
      message: L("updateReady", { v: info.version }),
      detail: L("updateDetail"),
      buttons: [L("restartNow"), L("later")],
      defaultId: 0,
      cancelId: 1,
    });
    if (response === 0) {
      quitting = true;
      updater.quitAndInstall();
    }
  });
  updater.on("error", (err) => console.error("[update]", err?.message ?? err));
  void checkUpdates(false);
  setInterval(() => void checkUpdates(false), 6 * 3_600_000).unref?.();
}

async function checkUpdates(manual) {
  if (!updater) return;
  try {
    const result = await updater.checkForUpdates();
    const latest = result?.updateInfo?.version;
    if (!manual) return;
    if (!latest || latest === app.getVersion()) {
      await dialog.showMessageBox({ type: "info", title: "VibeWorks", message: L("upToDate", { v: app.getVersion() }) });
    } else {
      toast("VibeWorks", L("updateLoading", { v: latest }));
    }
  } catch (err) {
    if (manual) await dialog.showMessageBox({ type: "warning", title: "VibeWorks", message: L("updateFailed", { msg: err?.message ?? String(err) }) });
  }
}

// ── IPC – nur von den erwarteten Seiten ──────────────────────
const fromFile = (e) => (e.senderFrame?.url ?? "").startsWith("file:");
const fromServer = (e) => isOwn(e.senderFrame?.url ?? "");

ipcMain.handle("setup:connect", async (e, input) => {
  if (!fromFile(e)) return { ok: false, error: "forbidden" };
  const list = candidates(input);
  if (!list.length) return { ok: false, error: L("invalidUrl") };
  let lastError = "";
  for (const origin of list) {
    try {
      await checkServer(origin);
      const changed = cfg.serverUrl !== origin;
      cfg.serverUrl = origin;
      if (changed) cfg.cursor = null;
      saveConfig();
      if (captureWin && !captureWin.isDestroyed()) captureWin.destroy(), (captureWin = null);
      if (setupWin && !setupWin.isDestroyed() && e.sender === setupWin.webContents) setupWin.close();
      showMain(origin);
      return { ok: true };
    } catch (err) {
      lastError = err?.message === L("notVibeworks") ? err.message : L("unreachable", { msg: err?.message ?? String(err) });
    }
  }
  return { ok: false, error: lastError };
});
ipcMain.on("setup:retry", (e) => {
  if (fromFile(e) && mainWin && !mainWin.isDestroyed()) void mainWin.loadURL(cfg.serverUrl);
});
ipcMain.on("setup:change", (e) => {
  if (fromFile(e)) openSetup();
});
ipcMain.on("capture:hide", (e) => {
  if (fromServer(e) && captureWin && !captureWin.isDestroyed()) captureWin.hide();
});
ipcMain.on("main:open", (e, p) => {
  if (!fromServer(e) || typeof p !== "string" || !p.startsWith("/") || p.startsWith("//")) return;
  showMain(new URL(p, cfg.serverUrl).toString());
});

// ── Start ────────────────────────────────────────────────────
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => showMain());
  app.whenReady().then(() => {
    lang = app.getLocale().toLowerCase().startsWith("de") ? "de" : "en";
    app.setAppUserModelId(APP_ID);
    Menu.setApplicationMenu(null);
    loadConfig();
    // Nur, was die Web-App braucht – und nur für den eigenen Server
    session.defaultSession.setPermissionRequestHandler((wc, permission, done) => {
      done(isOwn(wc.getURL()) && ["clipboard-sanitized-write", "clipboard-read", "fullscreen"].includes(permission));
    });
    buildTray();
    registerHotkey();
    setupUpdater();
    if (cfg.serverUrl) createMain();
    else openSetup();
    setInterval(() => void poll(), POLL_MS).unref?.();
    if (TEST) globalThis.__vw = { toggleCapture, showCapture, showMain, poll, shown, config: () => cfg };
  });
  app.on("window-all-closed", () => {
    // Der Tray hält die App am Leben; ohne Tray (Fehler) beenden
    if (!tray) app.quit();
  });
  app.on("before-quit", () => {
    quitting = true;
    saveBounds();
  });
  app.on("will-quit", () => globalShortcut.unregisterAll());
}
