// A tiny PNG reader (no dependency): 8-bit gray / RGB / palette / gray+alpha / RGBA, not interlaced = what Chrome's screenshots are. Returns RGBA bytes.
import { inflateSync } from "node:zlib";

export interface Img { w: number; h: number; rgba: Uint8Array }

export function decodePng(buf: Uint8Array): Img {
  const b = Buffer.from(buf);
  if (b.length < 33 || b.readUInt32BE(0) !== 0x89504e47) throw new Error("not a PNG file");
  let pos = 8, w = 0, h = 0, depth = 0, ctype = 0, interlace = 0, plte: Buffer | null = null, trns: Buffer | null = null;
  const idat: Buffer[] = [];
  while (pos + 8 <= b.length) {
    const len = b.readUInt32BE(pos), type = b.toString("ascii", pos + 4, pos + 8), body = b.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") { w = body.readUInt32BE(0); h = body.readUInt32BE(4); depth = body[8]!; ctype = body[9]!; interlace = body[12]!; }
    else if (type === "PLTE") plte = Buffer.from(body);
    else if (type === "tRNS") trns = Buffer.from(body);
    else if (type === "IDAT") idat.push(Buffer.from(body));
    else if (type === "IEND") break;
    pos += 12 + len;
  }
  if (depth !== 8 || interlace !== 0) throw new Error(`unsupported PNG (bit depth ${depth}, interlace ${interlace}): only 8-bit, not interlaced`);
  const ch = ({ 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 } as Record<number, number>)[ctype]; if (!ch) throw new Error("unsupported PNG colour type " + ctype);
  const raw = inflateSync(Buffer.concat(idat)), stride = w * ch, out = new Uint8Array(w * h * 4);
  let prev = new Uint8Array(stride), cur = new Uint8Array(stride), p = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[p++]!;
    for (let i = 0; i < stride; i++) {
      const x = raw[p++]!, a = i >= ch ? cur[i - ch]! : 0, up = prev[i]!, c = i >= ch ? prev[i - ch]! : 0;
      cur[i] = f === 0 ? x : f === 1 ? x + a : f === 2 ? x + up : f === 3 ? x + ((a + up) >> 1) : (() => { const pa = Math.abs(up - c), pb = Math.abs(a - c), pc = Math.abs(a + up - 2 * c); return x + (pa <= pb && pa <= pc ? a : pb <= pc ? up : c); })();
    }
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4, i = x * ch;
      if (ctype === 6) { out[o] = cur[i]!; out[o + 1] = cur[i + 1]!; out[o + 2] = cur[i + 2]!; out[o + 3] = cur[i + 3]!; }
      else if (ctype === 2) { out[o] = cur[i]!; out[o + 1] = cur[i + 1]!; out[o + 2] = cur[i + 2]!; out[o + 3] = 255; }
      else if (ctype === 0) { out[o] = out[o + 1] = out[o + 2] = cur[i]!; out[o + 3] = 255; }
      else if (ctype === 4) { out[o] = out[o + 1] = out[o + 2] = cur[i]!; out[o + 3] = cur[i + 1]!; }
      else { const k = cur[i]!; out[o] = plte?.[k * 3] ?? 0; out[o + 1] = plte?.[k * 3 + 1] ?? 0; out[o + 2] = plte?.[k * 3 + 2] ?? 0; out[o + 3] = trns?.[k] ?? 255; }
    }
    [prev, cur] = [cur, prev];
  }
  return { w, h, rgba: out };
}
