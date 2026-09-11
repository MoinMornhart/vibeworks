import type { Shape } from "../types";

// Namensraum „notes“ – deutsche Fassung ist maßgeblich, die englische muss dieselbe Form haben.

const de = {
  editor: {
    titlePlaceholder: "Titel (optional)",
    titleLabel: "Titel der Notiz",
    write: "Schreiben",
    preview: "Vorschau",
    contentPlaceholder: "Gedanken, Links, Checklisten …\n\n- [ ] Erste Aufgabe\n- [ ] Zweite Aufgabe",
    contentLabel: "Inhalt der Notiz",
    nothingToShow: "Nichts zu zeigen.",
    hint: "Markdown wird unterstützt · Strg+Enter speichert",
  },
  panel: {
    title: "Notizen",
    new: "Neue Notiz",
    confirmDelete: "Diese Notiz endgültig löschen?",
    emptyTitle: "Noch keine Notizen",
    emptyHint: "Ideen, Links, Befehle, Checklisten – alles, was sonst in einer Textdatei verschwindet.",
    first: "Erste Notiz",
    pin: "Anpinnen",
    unpin: "Lösen",
    pinned: "angepinnt",
    edited: "bearbeitet {ago}",
  },
};

const en: Shape<typeof de> = {
  editor: {
    titlePlaceholder: "Title (optional)",
    titleLabel: "Note title",
    write: "Write",
    preview: "Preview",
    contentPlaceholder: "Thoughts, links, checklists …\n\n- [ ] First task\n- [ ] Second task",
    contentLabel: "Note content",
    nothingToShow: "Nothing to show.",
    hint: "Markdown supported · Ctrl+Enter saves",
  },
  panel: {
    title: "Notes",
    new: "New note",
    confirmDelete: "Delete this note permanently?",
    emptyTitle: "No notes yet",
    emptyHint: "Ideas, links, commands, checklists – everything that would otherwise vanish in a text file.",
    first: "First note",
    pin: "Pin",
    unpin: "Unpin",
    pinned: "pinned",
    edited: "edited {ago}",
  },
};

export default { de, en };
