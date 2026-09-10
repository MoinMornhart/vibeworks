#!/usr/bin/env node
// Legt eine .env aus .env.example an und setzt ein zufälliges APP_SECRET.
// Eine vorhandene .env wird nie überschrieben.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

if (existsSync(".env")) {
  console.log(".env existiert bereits – nichts geändert.");
  process.exit(0);
}
const template = readFileSync(".env.example", "utf8");
const secret = randomBytes(32).toString("hex");
writeFileSync(".env", template.replace(/^APP_SECRET=.*$/m, `APP_SECRET=${secret}`));
console.log(".env angelegt, APP_SECRET erzeugt.");
