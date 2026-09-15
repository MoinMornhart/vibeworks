import { NextRequest } from "next/server";
import { z } from "zod";
import { describe, expect, it } from "vitest";
import { projectCreateSchema, projectPatchSchema, projectUpdateSchema, promptUpdateSchema } from "./validation";
import { ApiError, readBody } from "./api";
import { msgKey } from "./i18n/translate";

// zod 4 setzt .default() auch in optionalen Feldern ein. Update-Schemas
// dürfen deshalb nur enthalten, was wirklich geschickt wurde – sonst setzt
// ein Umbenennen Status, Fortschritt, Tags … zurück.

describe("Update-Schemas ohne Standardwerte", () => {
  it("Projekt: nur das Geschickte", () => {
    expect(projectUpdateSchema.parse({ name: "Neu" })).toEqual({ name: "Neu" });
    expect(projectUpdateSchema.parse({})).toEqual({});
    expect(projectPatchSchema.parse({ status: "DONE", confirmProtected: true })).toEqual({ status: "DONE", confirmProtected: true });
  });
  it("Prompt: Tags bleiben unangetastet", () => {
    const out = promptUpdateSchema.parse({ title: "Review" });
    expect(out).not.toHaveProperty("tags");
    expect(out.projectId).toBeUndefined();
  });
  it("Anlegen füllt die Standardwerte weiterhin", () => {
    expect(projectCreateSchema.parse({ name: "X" })).toMatchObject({ status: "IDEA", priority: 2, progress: 0, accent: "violet", tags: [], favorite: false });
  });
});

describe("readBody mit zod 4", () => {
  const schema = z.object({ name: z.string(), count: z.number().optional() });
  const post = (body: unknown) => new NextRequest("http://localhost/api/x", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
  const fieldErrorsOf = async (body: unknown) => {
    try {
      await readBody(post(body), schema);
      return null;
    } catch (err) {
      return err instanceof ApiError ? err.fieldErrors : "anderer Fehler";
    }
  };
  it("fehlendes Pflichtfeld → „Pflichtfeld fehlt“", async () => {
    expect(await fieldErrorsOf({})).toEqual({ name: msgKey("errors.required", { field: "name" }) });
  });
  it("falscher Typ → „Ungültiger Wert“", async () => {
    expect(await fieldErrorsOf({ name: "a", count: "drei" })).toEqual({ count: msgKey("errors.invalidValue", { field: "count" }) });
  });
  it("gültig → Daten", async () => {
    expect(await readBody(post({ name: "a" }), schema)).toEqual({ name: "a" });
  });
});
