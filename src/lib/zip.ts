import { inflateRawSync } from "node:zlib";

// Kleinster ZIP-Leser für Artefakte (gespeichert oder deflate) – ohne
// Abhängigkeit. Liest über das zentrale Verzeichnis, damit auch Einträge mit
// nachgestelltem Größenblock (Bit 3) stimmen. Mit Obergrenze gegen ZIP-Bomben.

export interface ZipEntry {
  name: string;
  data: Buffer;
}

const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;
const MAX_UNZIPPED = 20 * 1024 * 1024;

export function readZip(buf: Buffer): ZipEntry[] {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65_535); i--) {
    if (buf.readUInt32LE(i) === EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Kein ZIP");
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out: ZipEntry[] = [];
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== CENTRAL) throw new Error("ZIP beschädigt");
    const method = buf.readUInt16LE(p + 10);
    const compressed = buf.readUInt32LE(p + 20);
    const size = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    p += 46 + nameLen + extraLen + commentLen;
    if (size > MAX_UNZIPPED) throw new Error("ZIP zu groß");
    if (buf.readUInt32LE(local) !== LOCAL) throw new Error("ZIP beschädigt");
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = buf.subarray(start, start + compressed);
    if (method === 0) out.push({ name, data: Buffer.from(raw) });
    else if (method === 8) out.push({ name, data: inflateRawSync(raw, { maxOutputLength: MAX_UNZIPPED }) });
    else throw new Error(`ZIP-Verfahren ${method} wird nicht unterstützt`);
  }
  return out;
}
