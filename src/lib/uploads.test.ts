import { describe, expect, it } from "vitest";
import { isUploadId, sniffImage } from "./uploads";

const bytes = (...parts: Array<number[] | string>) =>
  new Uint8Array(parts.flatMap((p) => (typeof p === "string" ? [...p].map((c) => c.charCodeAt(0)) : p)).concat(new Array(16).fill(0)));

describe("sniffImage", () => {
  it("erkennt die erlaubten Formate am Inhalt", () => {
    expect(sniffImage(bytes([0x89], "PNG", [0x0d, 0x0a]))?.ext).toBe("png");
    expect(sniffImage(bytes([0xff, 0xd8, 0xff, 0xe0]))?.ext).toBe("jpg");
    expect(sniffImage(bytes("GIF89a"))?.ext).toBe("gif");
    expect(sniffImage(bytes("RIFF", [0, 0, 0, 0], "WEBP"))?.ext).toBe("webp");
    expect(sniffImage(bytes([0, 0, 0, 0x1c], "ftypavif"))?.ext).toBe("avif");
  });

  it("lehnt SVG, HTML und Unsinn ab", () => {
    expect(sniffImage(bytes('<svg xmlns="http://www.w3.org/2000/svg">'))).toBeNull();
    expect(sniffImage(bytes("<!doctype html><script>"))).toBeNull();
    expect(sniffImage(new Uint8Array(4))).toBeNull();
  });
});

describe("isUploadId", () => {
  it("lässt keine Pfadtricks durch", () => {
    expect(isUploadId("cmtvgjiz00000hkn8oll4jpir")).toBe(true);
    expect(isUploadId("../../etc/passwd")).toBe(false);
    expect(isUploadId("ABC.png")).toBe(false);
  });
});
