#!/usr/bin/env node
// Zählt die Version um eine Stufe hoch – wie ein Zählwerk mit Übertrag bei 9:
//   0.0.1 → 0.0.2 → … → 0.0.9 → 0.1.0 → … → 0.9.9 → 1.0.0
//
// Aufruf:  npm run version:bump          (schreibt package.json)
//          node scripts/bump-version.mjs --dry   (zeigt nur an)
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

export function nextVersion(version) {
  const parts = version.split(".").map((n) => Number.parseInt(n, 10));
  if (parts.length !== 3 || parts.some((n) => !Number.isInteger(n) || n < 0)) {
    throw new Error(`Ungültige Version: ${version}`);
  }
  let [major, minor, patch] = parts;
  patch += 1;
  if (patch > 9) {
    patch = 0;
    minor += 1;
  }
  if (minor > 9) {
    minor = 0;
    major += 1;
  }
  return `${major}.${minor}.${patch}`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const file = join(dirname(fileURLToPath(import.meta.url)), "..", "package.json");
  const raw = readFileSync(file, "utf8");
  const pkg = JSON.parse(raw);
  const next = nextVersion(pkg.version);
  if (process.argv.includes("--dry")) {
    console.log(`${pkg.version} → ${next}`);
  } else {
    writeFileSync(file, raw.replace(`"version": "${pkg.version}"`, `"version": "${next}"`));
    console.log(`Version: ${pkg.version} → ${next}`);
    console.log("Nicht vergessen: Eintrag in src/lib/changelog.ts ergänzen.");
  }
}
