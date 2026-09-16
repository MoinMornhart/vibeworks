import { describe, expect, it } from "vitest";
import { memoCreateSchema, memoFileSchema } from "./codeMemoLogic";

describe("Memo-Netz", () => {
  it("nimmt nur saubere Repository-Pfade", () => {
    expect(memoFileSchema.safeParse("src/lib/db.ts").success).toBe(true);
    expect(memoFileSchema.safeParse("pkg:react").success).toBe(true);
    expect(memoFileSchema.safeParse("/etc/passwd").success).toBe(false);
    expect(memoFileSchema.safeParse("src/../../geheim").success).toBe(false);
    expect(memoFileSchema.safeParse("a\\b").success).toBe(false);
    expect(memoFileSchema.safeParse("").success).toBe(false);
  });

  it("verlangt Text und begrenzt ihn", () => {
    expect(memoCreateSchema.safeParse({ file: "a.ts", text: "  " }).success).toBe(false);
    expect(memoCreateSchema.safeParse({ file: "a.ts", text: "x".repeat(2001) }).success).toBe(false);
    expect(memoCreateSchema.parse({ file: " a.ts ", text: " Achtung: wird von 40 Dateien genutzt " })).toEqual({ file: "a.ts", text: "Achtung: wird von 40 Dateien genutzt" });
  });
});
