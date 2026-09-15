import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { readZip } from "./zip";

/** Minimales ZIP mit einem Eintrag bauen – wie es upload-artifact liefert (Größen ggf. erst im zentralen Verzeichnis). */
function makeZip(name: string, content: Buffer, method: 0 | 8, sizesInLocal = true): Buffer {
  const data = method === 8 ? deflateRawSync(content) : content;
  const nameBuf = Buffer.from(name);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(sizesInLocal ? 0 : 8, 6);
  local.writeUInt16LE(method, 8);
  local.writeUInt32LE(sizesInLocal ? data.length : 0, 18);
  local.writeUInt32LE(sizesInLocal ? content.length : 0, 22);
  local.writeUInt16LE(nameBuf.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(method, 10);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt32LE(content.length, 24);
  central.writeUInt16LE(nameBuf.length, 28);
  central.writeUInt32LE(0, 42);
  const cdOffset = local.length + nameBuf.length + data.length;
  const cd = Buffer.concat([central, nameBuf]);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(cdOffset, 16);
  return Buffer.concat([local, nameBuf, data, cd, eocd]);
}

describe("readZip", () => {
  const json = Buffer.from(JSON.stringify({ counts: { secrets: 1 } }));
  it("gespeichert", () => {
    expect(readZip(makeZip("vibeworks-check.json", json, 0))).toEqual([{ name: "vibeworks-check.json", data: json }]);
  });
  it("deflate, Größen nur im zentralen Verzeichnis", () => {
    const [entry] = readZip(makeZip("a.json", json, 8, false));
    expect(entry.data.toString()).toBe(json.toString());
  });
  it("kein ZIP → Fehler", () => {
    expect(() => readZip(Buffer.from("das ist kein zip, sondern text …………………"))).toThrow();
  });
});
