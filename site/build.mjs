// Baut die Webseite (GitHub Pages) nach _site/: Seiten aus site/pages/*.html
// werden in site/layout.html gesetzt; Banner, Screenshots und Logo kommen aus
// dem Repo dazu, damit nichts doppelt gepflegt wird. Ohne Abhängigkeiten.
//   node site/build.mjs
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "_site");
const pagesDir = path.join(root, "site", "pages");

const NAV = {
  de: { features: "Funktionen", docs: "Doku", switch: "English", footer: "VibeWorks · MIT-Lizenz · selbst gehostet, ohne Tracking" },
  en: { features: "Features", docs: "Docs", switch: "Deutsch", footer: "VibeWorks · MIT license · self-hosted, no tracking" },
};

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const layout = readFileSync(path.join(root, "site", "layout.html"), "utf8");

const fill = (text, vars) => text.replace(/\{\{([\w.]+)\}\}/g, (match, key) => (key in vars ? vars[key] : match));

let count = 0;
for (const file of readdirSync(pagesDir).filter((f) => f.endsWith(".html"))) {
  const src = readFileSync(path.join(pagesDir, file), "utf8");
  const head = src.match(/^<!--\s*(\{[\s\S]*?\})\s*-->/);
  if (!head) throw new Error(`${file}: Kopfzeile fehlt`);
  const meta = JSON.parse(head[1]);
  const depth = meta.path.split("/").length - 1;
  const nav = NAV[meta.lang];
  const vars = {
    lang: meta.lang,
    title: meta.title,
    description: meta.description,
    base: depth ? "../".repeat(depth) : "./",
    home: meta.lang === "en" ? "en/" : "",
    alt: meta.alt,
    altLang: meta.lang === "en" ? "de" : "en",
    "nav.features": nav.features,
    "nav.docs": nav.docs,
    "nav.switch": nav.switch,
    "nav.footer": nav.footer,
  };
  // Erst den Seiteninhalt füllen, dann ins Layout – Unbekanntes wie {{projekt}} bleibt stehen
  const body = fill(src.slice(head[0].length).trim(), vars);
  const html = fill(layout, { ...vars, body });
  const target = path.join(out, meta.path);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, html);
  count++;
}

cpSync(path.join(root, "site", "static"), out, { recursive: true });
cpSync(path.join(root, "docs", "assets"), path.join(out, "assets"), { recursive: true });
cpSync(path.join(root, "docs", "screenshots"), path.join(out, "screenshots"), { recursive: true });
cpSync(path.join(root, "src", "app", "icon.svg"), path.join(out, "icon.svg"));
writeFileSync(path.join(out, ".nojekyll"), "");
console.log(`Webseite gebaut: ${count} Seiten → _site/`);
