// Einrichtung (Server-Adresse) und Offline-Hinweis – eine Seite, zwei Ansichten.
const q = new URLSearchParams(location.search);
const lang = q.get("lang") === "en" ? "en" : "de";
const server = q.get("server") || "";

const T = {
  de: {
    title: "Mit deinem Server verbinden",
    text: "Unter welcher Adresse läuft dein VibeWorks? Danach meldest du dich wie gewohnt an.",
    label: "Server-Adresse",
    connect: "Verbinden",
    connecting: "Verbinde …",
    hint: "Tipp: Die Schnellerfassung holst du später überall mit Strg+Alt+V nach vorn.",
    offTitle: "Server nicht erreichbar",
    offText: "{server} antwortet gerade nicht. Läuft der Server, und bist du im richtigen Netz?",
    retry: "Erneut versuchen",
    change: "Andere Adresse",
  },
  en: {
    title: "Connect to your server",
    text: "At which address does your VibeWorks run? Then sign in as usual.",
    label: "Server address",
    connect: "Connect",
    connecting: "Connecting …",
    hint: "Tip: later you can bring up quick capture from anywhere with Ctrl+Alt+V.",
    offTitle: "Server not reachable",
    offText: "{server} is not answering right now. Is the server running, and are you on the right network?",
    retry: "Try again",
    change: "Different address",
  },
}[lang];

const $ = (id) => document.getElementById(id);
for (const key of ["title", "text", "label", "hint", "offTitle"]) $(`t-${key}`).textContent = T[key];
$("t-offText").textContent = T.offText.replace("{server}", server);
$("connect").textContent = T.connect;
$("retry").textContent = T.retry;
$("change").textContent = T.change;
$("url").value = server;
document.documentElement.lang = lang;

if (q.get("mode") === "offline") {
  $("setup").hidden = true;
  $("offline").hidden = false;
} else {
  $("url").focus();
}

$("form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const button = $("connect");
  button.disabled = true;
  button.textContent = T.connecting;
  $("error").textContent = "";
  try {
    const res = await window.vwSetup.connect($("url").value);
    if (!res.ok) $("error").textContent = res.error;
  } finally {
    button.disabled = false;
    button.textContent = T.connect;
  }
});
$("retry").addEventListener("click", () => window.vwSetup.retry());
$("change").addEventListener("click", () => window.vwSetup.change());
