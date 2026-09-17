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
  draft: { restored: "Entwurf wiederhergestellt", discard: "Verwerfen" },
  dialog: { confirmTitle: "Bitte bestätigen", promptTitle: "Eingabe", confirm: "Bestätigen" },
  leave: {
    title: "Ungespeicherte Eingaben",
    draftMessage: "Du hast noch nicht gespeichert. Als Entwurf behalten? Beim nächsten Öffnen ist dann alles wieder da.",
    editMessage: "Deine Änderungen sind noch nicht gespeichert.",
    keep: "Als Entwurf behalten",
    discard: "Verwerfen",
    discardChanges: "Änderungen verwerfen",
    stay: "Weiter schreiben",
  },
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
  draft: { restored: "Draft restored", discard: "Discard" },
  dialog: { confirmTitle: "Please confirm", promptTitle: "Input", confirm: "Confirm" },
  leave: {
    title: "Unsaved input",
    draftMessage: "You haven't saved yet. Keep it as a draft? Everything will be back the next time you open this.",
    editMessage: "Your changes haven't been saved yet.",
    keep: "Keep as draft",
    discard: "Discard",
    discardChanges: "Discard changes",
    stay: "Keep writing",
  },
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
