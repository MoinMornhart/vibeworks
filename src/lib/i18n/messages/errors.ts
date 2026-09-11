import type { Shape } from "../types";
import { plural } from "../translate";

// Allgemeine Fehler der API (Rahmen, Anmeldung, Begrenzung). Bereichsfehler
// stehen im jeweiligen Namensraum unter "errors".

const de = {
  notLoggedIn: "Nicht angemeldet",
  adminOnly: "Nur für Administratoren",
  notFound: "Nicht gefunden",
  foreignOrigin: "Anfrage von fremder Herkunft abgewiesen",
  contentType: "Erwartet Content-Type: application/json",
  tooLarge: "Anfrage zu groß",
  invalidJson: "Ungültiges JSON",
  invalidInput: "Ungültige Eingabe",
  required: "Pflichtfeld fehlt: {field}",
  invalidValue: "Ungültiger Wert: {field}",
  internal: "Interner Fehler",
  rateLimited: plural("Zu viele Versuche. Bitte in {n} Minute erneut versuchen.", "Zu viele Versuche. Bitte in {n} Minuten erneut versuchen."),
};

const en: Shape<typeof de> = {
  notLoggedIn: "Not signed in",
  adminOnly: "Administrators only",
  notFound: "Not found",
  foreignOrigin: "Request from a foreign origin rejected",
  contentType: "Expected Content-Type: application/json",
  tooLarge: "Request too large",
  invalidJson: "Invalid JSON",
  invalidInput: "Invalid input",
  required: "Required field missing: {field}",
  invalidValue: "Invalid value: {field}",
  internal: "Internal error",
  rateLimited: plural("Too many attempts. Please try again in {n} minute.", "Too many attempts. Please try again in {n} minutes."),
};

export default { de, en };
