import type { Shape } from "../types";

// Namensraum „validation“ – deutsche Fassung ist maßgeblich, die englische muss dieselbe Form haben.
// Meldungen der Zod-Schemas in src/lib/validation.ts.

const de = {
  username: {
    min: "Benutzername: mindestens 3 Zeichen",
    max: "Benutzername: höchstens 32 Zeichen",
    chars: "Benutzername: nur a–z, 0–9, Punkt, Binde- und Unterstrich",
    missing: "Benutzername fehlt",
  },
  passwordMissing: "Passwort fehlt",
  newPasswordMissing: "Neues Passwort fehlt",
  token: {
    tooShort: "Das Token ist zu kurz",
    tooLong: "Das Token ist zu lang",
    invalidChars: "Das Token enthält ungültige Zeichen",
  },
  repoUrl: "Bitte eine Repository-Adresse (https://… oder git@…)",
  serverTooLong: "Adresse zu lang",
  nameMissing: "Name fehlt",
  nameMax120: "Name: höchstens 120 Zeichen",
  note: {
    tooLong: "Notiz: höchstens 50 000 Zeichen",
    empty: "Die Notiz ist leer",
  },
  date: {
    format: "Datum als JJJJ-MM-TT",
    invalid: "Ungültiges Datum",
  },
  titleMissing: "Titel fehlt",
  titleMax200: "Titel: höchstens 200 Zeichen",
  displayNameMax60: "Anzeigename: höchstens 60 Zeichen",
  emailInvalid: "Bitte eine gültige E-Mail-Adresse",
  codeMissing: "Code fehlt",
  max60Chars: "Höchstens 60 Zeichen",
  min0: "Mindestens 0",
  max500: "Höchstens 500",
  maxMillionChars: "Höchstens eine Million Zeichen",
};

const en: Shape<typeof de> = {
  username: {
    min: "Username: at least 3 characters",
    max: "Username: at most 32 characters",
    chars: "Username: only a–z, 0–9, period, hyphen and underscore",
    missing: "Username is missing",
  },
  passwordMissing: "Password is missing",
  newPasswordMissing: "New password is missing",
  token: {
    tooShort: "The token is too short",
    tooLong: "The token is too long",
    invalidChars: "The token contains invalid characters",
  },
  repoUrl: "Please enter a repository address (https://… or git@…)",
  serverTooLong: "Address too long",
  nameMissing: "Name is missing",
  nameMax120: "Name: at most 120 characters",
  note: {
    tooLong: "Note: at most 50,000 characters",
    empty: "The note is empty",
  },
  date: {
    format: "Date as YYYY-MM-DD",
    invalid: "Invalid date",
  },
  titleMissing: "Title is missing",
  titleMax200: "Title: at most 200 characters",
  displayNameMax60: "Display name: at most 60 characters",
  emailInvalid: "Please enter a valid email address",
  codeMissing: "Code is missing",
  max60Chars: "At most 60 characters",
  min0: "At least 0",
  max500: "At most 500",
  maxMillionChars: "At most one million characters",
};

export default { de, en };
