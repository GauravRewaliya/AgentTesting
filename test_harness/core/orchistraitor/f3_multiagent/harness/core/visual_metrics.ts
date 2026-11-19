// Pixel measures of ONE picture of a page / scene. Pure code, no model, no randomness: the same picture always gives the same numbers.
//   clutter   share of pixels on a strong edge (confetti, noise, a crowded scene have many; a calm scene few)
//   dark      share of near-black pixels (a muddy, unlit or shadow-heavy frame)
//   flat      share of the frame in the ONE most common colour (a flat, unlit ground or sky; an empty frame)
//   confetti  small isolated blobs of petal / sparkle colour (pink or maroon, 2 to 120 px at 640 wide) per 100 000 px: loose particles in front of the scene
//   petal     share of the frame in pink / maroon pixels (how much of the picture the particles take)
//   blank     1 when the frame is (nearly) one colour (a page that did not render), else 0
import { decodePng, type Img } from "./png.ts";

export interface Metrics { clutter: number; dark: number; flat: number; confetti: number; petal: number; blank: 0 | 1; w: number; h: number }

/** 2x2 (or n x n) box average down to about `target` px wide: removes screenshot noise and makes the numbers independent of the capture size. */
function shrink(img: Img, target = 640): { w: number; h: number; r: Float32Array; g: Float32Array; b: Float32Array } {
  const n = Math.max(1, Math.round(img.w / target)), w = Math.floor(img.w / n), h = Math.floor(img.h / n);
  const r = new Float32Array(w * h), g = new Float32Array(w * h), b = new Float32Array(w * h), k = n * n;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let sr = 0, sg = 0, sb = 0;
    for (let dy = 0; dy < n; dy++) for (let dx = 0; dx < n; dx++) { const o = ((y * n + dy) * img.w + (x * n + dx)) * 4; sr += img.rgba[o]!; sg += img.rgba[o + 1]!; sb += img.rgba[o + 2]!; }
    const i = y * w + x; r[i] = sr / k; g[i] = sg / k; b[i] = sb / k;
  }
  return { w, h, r, g, b };
}

export function measure(png: Uint8Array): Metrics {
  const img = decodePng(png), s = shrink(img), { w, h, r, g, b } = s, N = w * h;
  const lum = new Float32Array(N); for (let i = 0; i < N; i++) lum[i] = 0.299 * r[i]! + 0.587 * g[i]! + 0.114 * b[i]!;
  let edge = 0, dark = 0; const bins = new Map<number, number>(); const petalMask = new Uint8Array(N); let petal = 0;
  for (let y = 0; y < h - 1; y++) for (let x = 0; x < w - 1; x++) { const i = y * w + x; if (Math.abs(lum[i + 1]! - lum[i]!) + Math.abs(lum[i + w]! - lum[i]!) > 60) edge++; }
  for (let i = 0; i < N; i++) {
    if (lum[i]! < 60) dark++;
    const key = ((r[i]! >> 4) << 8) | ((g[i]! >> 4) << 4) | (b[i]! >> 4); bins.set(key, (bins.get(key) ?? 0) + 1);
    const R = r[i]!, G = g[i]!, B = b[i]!;
    const pink = R > 200 && G > 120 && B > 140 && R > G + 30, maroon = R > 70 && R < 170 && G < 70 && B < 110 && R > G + 40;
    if (pink || maroon) { petalMask[i] = 1; petal++; }
  }
  // connected blobs of the petal mask (4-neighbour): count the small ones
  const seen = new Uint8Array(N); let small = 0; const stack: number[] = [];
  for (let i = 0; i < N; i++) {
    if (!petalMask[i] || seen[i]) continue;
    let size = 0; stack.push(i); seen[i] = 1;
    while (stack.length) { const c = stack.pop()!; size++; const x = c % w, y = (c / w) | 0; for (const j of [x > 0 ? c - 1 : -1, x < w - 1 ? c + 1 : -1, y > 0 ? c - w : -1, y < h - 1 ? c + w : -1]) if (j >= 0 && petalMask[j] && !seen[j]) { seen[j] = 1; stack.push(j); } }
    if (size >= 2 && size <= 120) small++;
  }
  const top = Math.max(...bins.values()), flat = top / N;
  return { clutter: edge / N, dark: dark / N, flat, confetti: (small / N) * 100000, petal: petal / N, blank: flat > 0.97 ? 1 : 0, w: img.w, h: img.h };
}
