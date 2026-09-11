import type { Shape } from "../types";

// Allgemeine Wörter, die überall vorkommen. Bereichsspezifisches gehört in
// den eigenen Namensraum, auch wenn es dadurch doppelt vorkommt.

const de = {
  save: "Speichern",
  saving: "Speichere …",
  cancel: "Abbrechen",
  delete: "Löschen",
  edit: "Bearbeiten",
  close: "Schließen",
  back: "Zurück",
  create: "Anlegen",
  add: "Hinzufügen",
  remove: "Entfernen",
  copy: "Kopieren",
  copied: "Kopiert",
  search: "Suchen",
  open: "Öffnen",
  optional: "optional",
  loading: "Lade …",
  yes: "Ja",
  no: "Nein",
  language: {
    title: "Sprache",
    description: "In welcher Sprache VibeWorks mit dir spricht. Gilt auf allen deinen Geräten.",
    label: "Sprache",
  },
};

const en: Shape<typeof de> = {
  save: "Save",
  saving: "Saving …",
  cancel: "Cancel",
  delete: "Delete",
  edit: "Edit",
  close: "Close",
  back: "Back",
  create: "Create",
  add: "Add",
  remove: "Remove",
  copy: "Copy",
  copied: "Copied",
  search: "Search",
  open: "Open",
  optional: "optional",
  loading: "Loading …",
  yes: "Yes",
  no: "No",
  language: {
    title: "Language",
    description: "The language VibeWorks speaks to you in. Applies on all your devices.",
    label: "Language",
  },
};

export default { de, en };
