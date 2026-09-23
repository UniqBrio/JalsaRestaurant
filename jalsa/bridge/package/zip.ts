import { deflateRawSync, inflateRawSync } from 'node:zlib';

/**
 * zip — enough of PKZIP to make the Windows download and to read the Node runtime out of its own.
 *
 * WHY NOT A LIBRARY
 *   The application has no zip dependency and this is the only thing that would use one. The
 *   format needed here — local headers, a central directory, an end record, deflate or stored —
 *   is small, stable since 1993, and every byte of it is written and read back by a unit spec.
 *   A dependency for it would be a supply-chain surface on the artifact a restaurant installs.
 *
 * WHAT IS DELIBERATELY ABSENT
 *   Zip64 (nothing here approaches 4 GB), encryption, and streaming: a package is assembled in
 *   memory and written once. Reading handles data descriptors (Node's own zip uses them) by taking
 *   sizes from the central directory, which is the authoritative place.
 */

export interface ZipEntry {
  name: string;
  data: Uint8Array;
  /** Stored (`0`) or deflated (`8`). Already-compressed payloads (an .exe) are stored. */
  method?: 0 | 8;
}

/* ── CRC-32, the IEEE polynomial, table-driven ─────────────────────────── */

const TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) c = (TABLE[(c ^ (bytes[i] as number)) & 0xff] as number) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/* ── Writing ───────────────────────────────────────────────────────────── */

/** MS-DOS time and date, which is what the format has room for. Two-second resolution. */
function dosStamp(at: Date): { time: number; date: number } {
  const year = Math.max(1980, at.getUTCFullYear());
  return {
    time: (at.getUTCHours() << 11) | (at.getUTCMinutes() << 5) | Math.floor(at.getUTCSeconds() / 2),
    date: ((year - 1980) << 9) | ((at.getUTCMonth() + 1) << 5) | at.getUTCDate(),
  };
}

const u16 = (n: number): Buffer => {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(n & 0xffff);
  return b;
};
const u32 = (n: number): Buffer => {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n >>> 0);
  return b;
};

export function writeZip(entries: readonly ZipEntry[], at: Date = new Date()): Buffer {
  const { time, date } = dosStamp(at);
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const method = entry.method ?? 8;
    const raw = Buffer.from(entry.data);
    const payload = method === 8 ? deflateRawSync(raw) : raw;
    const crc = crc32(raw);

    const local = Buffer.concat([
      u32(0x04034b50), u16(20), u16(0x0800) /* UTF-8 names */, u16(method), u16(time), u16(date),
      u32(crc), u32(payload.length), u32(raw.length), u16(name.length), u16(0), name, payload,
    ]);
    const central = Buffer.concat([
      u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(method), u16(time), u16(date),
      u32(crc), u32(payload.length), u32(raw.length), u16(name.length), u16(0), u16(0), u16(0), u16(0),
      u32(0), u32(offset), name,
    ]);
    locals.push(local);
    centrals.push(central);
    offset += local.length;
  }

  const directory = Buffer.concat(centrals);
  const end = Buffer.concat([
    u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length), u32(directory.length), u32(offset), u16(0),
  ]);
  return Buffer.concat([...locals, directory, end]);
}

/* ── Reading ───────────────────────────────────────────────────────────── */

export interface ZipListing {
  name: string;
  method: number;
  compressedSize: number;
  size: number;
  crc: number;
  localOffset: number;
}

/** The central directory, which is the truth about what a zip holds. */
export function listZip(zip: Buffer): ZipListing[] {
  // The end record is within the last 64 KiB + 22 bytes (the maximum comment length).
  const floor = Math.max(0, zip.length - 0x10000 - 22);
  let eocd = -1;
  for (let i = zip.length - 22; i >= floor; i -= 1) {
    if (zip.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('Not a zip file: no end-of-central-directory record.');
  const count = zip.readUInt16LE(eocd + 10);
  let p = zip.readUInt32LE(eocd + 16);

  const out: ZipListing[] = [];
  for (let n = 0; n < count; n += 1) {
    if (zip.readUInt32LE(p) !== 0x02014b50) throw new Error(`Corrupt zip: central directory entry ${n} has a bad signature.`);
    const method = zip.readUInt16LE(p + 10);
    const crc = zip.readUInt32LE(p + 16);
    const compressedSize = zip.readUInt32LE(p + 20);
    const size = zip.readUInt32LE(p + 24);
    const nameLen = zip.readUInt16LE(p + 28);
    const extraLen = zip.readUInt16LE(p + 30);
    const commentLen = zip.readUInt16LE(p + 32);
    const localOffset = zip.readUInt32LE(p + 42);
    const name = zip.subarray(p + 46, p + 46 + nameLen).toString('utf8');
    out.push({ name, method, compressedSize, size, crc, localOffset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

/** One entry's bytes, verified against the directory's CRC. */
export function readZipEntry(zip: Buffer, entry: ZipListing): Buffer {
  const p = entry.localOffset;
  if (zip.readUInt32LE(p) !== 0x04034b50) throw new Error(`Corrupt zip: ${entry.name} has a bad local header.`);
  const nameLen = zip.readUInt16LE(p + 26);
  const extraLen = zip.readUInt16LE(p + 28);
  const start = p + 30 + nameLen + extraLen;
  const payload = zip.subarray(start, start + entry.compressedSize);
  let data: Buffer;
  if (entry.method === 0) data = Buffer.from(payload);
  else if (entry.method === 8) data = inflateRawSync(payload);
  else throw new Error(`Unsupported zip method ${entry.method} for ${entry.name}.`);
  if (data.length !== entry.size) throw new Error(`Corrupt zip: ${entry.name} is ${data.length} bytes, expected ${entry.size}.`);
  if (crc32(data) !== entry.crc) throw new Error(`Corrupt zip: ${entry.name} failed its CRC.`);
  return data;
}

export function readZip(zip: Buffer): Map<string, Buffer> {
  const out = new Map<string, Buffer>();
  for (const entry of listZip(zip)) if (!entry.name.endsWith('/')) out.set(entry.name, readZipEntry(zip, entry));
  return out;
}
