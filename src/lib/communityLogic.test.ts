import { describe, expect, it } from "vitest";
import { canDelete, canEdit, canModerate, canSee, canWrite, excerpt } from "./communityLogic";

const owner = { id: "owner", isAdmin: false };
const admin = { id: "admin", isAdmin: true };
const author = { id: "author", isAdmin: false };
const other = { id: "other", isAdmin: false };

describe("Community-Rechte", () => {
  it("moderieren: Besitzer und Admins", () => {
    expect(canModerate(owner, "owner")).toBe(true);
    expect(canModerate(admin, "owner")).toBe(true);
    expect(canModerate(other, "owner")).toBe(false);
  });
  it("Ausgeblendetes sehen nur Autor und Moderation", () => {
    const hidden = { hidden: true, authorId: "author" };
    expect(canSee(author, hidden, "owner")).toBe(true);
    expect(canSee(owner, hidden, "owner")).toBe(true);
    expect(canSee(admin, hidden, "owner")).toBe(true);
    expect(canSee(other, hidden, "owner")).toBe(false);
    expect(canSee(other, { hidden: false, authorId: "author" }, "owner")).toBe(true);
  });
  it("Lobby (ohne Besitzer): nur Admins moderieren", () => {
    expect(canModerate(owner, "")).toBe(false);
    expect(canModerate(admin, "")).toBe(true);
    expect(canDelete(author, "author", "")).toBe(true);
    expect(canDelete(other, "author", "")).toBe(false);
  });
  it("Sperren verhindern das Schreiben", () => {
    expect(canWrite({ banned: false }, false)).toBe(true);
    expect(canWrite({ banned: true }, false)).toBe(false);
    expect(canWrite({ banned: false }, true)).toBe(false);
  });
  it("bearbeiten nur der Autor, löschen auch die Moderation", () => {
    expect(canEdit(author, "author")).toBe(true);
    expect(canEdit(owner, "author")).toBe(false);
    expect(canDelete(owner, "author", "owner")).toBe(true);
    expect(canDelete(other, "author", "owner")).toBe(false);
  });
  it("Kurzfassung ohne Markdown", () => {
    expect(excerpt("## Titel\n\n**fett** und [Link](https://x.example)")).toBe("Titel fett und Link https://x.example");
    expect(excerpt("a".repeat(300), 10)).toBe("aaaaaaaaa…");
  });
});
