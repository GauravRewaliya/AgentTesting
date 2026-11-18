// `ref_compare`: does the clone match the reference? Measured in a REAL browser (core/browse.ts), no model call. Compares the clone's page with the reference's outline.json (made by ref_capture):
// sections, card grids, calls to action, icons / images, animation, page height, fonts, accent, dark theme, scroll-reveal, plus links that lead nowhere. Output: a score and one line per gap, so the builder fixes exactly that.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { par, browse, type Outline } from "./browse.ts";

const rgb = (c: string) => (/rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c) ?? []).slice(1, 4).map(Number);
const lum = (c: string) => { const [r = 0, g = 0, b = 0] = rgb(c); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export async function refCompare(o: { refDir: string; url: string; outDir: string }): Promise<Record<string, unknown>> {
  const refFile = join(o.refDir, "outline.json"); if (!existsSync(refFile)) return { ok: false, reason: `no ${refFile}: run ref_capture first` };
  const ref = JSON.parse(readFileSync(refFile, "utf8")) as Outline;
  const [L, D, M] = await par([() => browse({ url: o.url, outDir: o.outDir, scheme: "light", sectionShots: 3, tag: "clone-light" }), () => browse({ url: o.url, outDir: o.outDir, scheme: "dark", steps: [{ outline: true }] }), () => browse({ url: o.url, outDir: o.outDir, scheme: "light", mobile: true, steps: [{ outline: true }, { shot: "clone-mobile.png", full: true }] })]);
  if (!L.ok || !L.outline) return { ok: false, reason: L.reason ?? "the clone did not render", console: L.console };
  const me = L.outline, gaps: string[] = [], good: string[] = [];
  const n = (x: Outline, f: (s: Outline["sections"][number]) => boolean) => x.sections.filter(f).length;
  const cmp = (label: string, a: number, b: number, tol = 1) => { if (b + tol < a) gaps.push(`${label}: the reference has ${a}, the clone ${b}`); else good.push(`${label} ${b}/${a}`); };
  cmp("sections", ref.sections.length, me.sections.length, 1);
  cmp("sections with a card grid", n(ref, (s) => s.cards >= 3), n(me, (s) => s.cards >= 3), 0);
  cmp("sections with a call to action button", n(ref, (s) => s.buttons.length > 0), n(me, (s) => s.buttons.length > 0), 0);
  cmp("sections with icons / images", n(ref, (s) => s.images >= 3), n(me, (s) => s.images >= 3), 1);
  cmp("animated sections", n(ref, (s) => s.animated), n(me, (s) => s.animated), 1);
  const refImgs = ref.sections.reduce((a, s) => a + s.images, 0), myImgs = me.sections.reduce((a, s) => a + s.images, 0); if (myImgs < refImgs * 0.4) gaps.push(`icons / images in total: the reference has ${refImgs}, the clone ${myImgs}: add icons (inline svg) and visuals`);
  if (me.doc_h < ref.doc_h * 0.6) gaps.push(`page height: the reference is ${ref.doc_h}px, the clone ${me.doc_h}px: too short, more content / spacing needed`); else good.push(`page height ${me.doc_h}/${ref.doc_h}`);
  if (me.fonts[0] && ref.fonts[0] && me.fonts[0] !== ref.fonts[0]) gaps.push(`font: the reference uses "${ref.fonts[0]}", the clone "${me.fonts[0]}" (load it from Google Fonts in css/theme.css)`);
  const dark = D.outline; if (!dark || Math.abs(lum(dark.theme.bg) - lum(me.theme.bg)) < 40) gaps.push("dark theme: with prefers-color-scheme: dark the clone looks the same as in light mode (needs a theme that follows the system and a toggle)"); else good.push("dark theme works");
  if (ref.scrollReveal && !me.scrollReveal) gaps.push("scroll animation: the reference reveals content on scroll; add class `reveal` (+ d1..d4) to section content");
  if (ref.keyframes.length >= 3 && me.keyframes.length < 2) gaps.push(`motion: the reference has ${ref.keyframes.length} keyframe animations, the clone ${me.keyframes.length}`);
  const dead = me.links.filter((l) => !l.href || l.href === "#" || /^javascript:/i.test(l.href)); if (dead.length) gaps.push(`dead links (href="#"): ${dead.slice(0, 5).map((l) => `"${l.text}"`).join(", ")}`);
  const mob = M.outline; if (mob && mob.doc_h < 600) gaps.push("mobile: the page is almost empty at 390px width"); if (mob && L.outline && mob.sections.length < 2) gaps.push("mobile: sections collapsed");
  const score = Math.max(0, Math.round(100 - gaps.length * 9));
  return { ok: true, browser: L.via === "connected" ? "connected Chrome" : "private headless Chrome", score, verdict: gaps.length === 0 ? "MATCHES the reference structure" : gaps.length <= 2 ? "close: fix the gaps" : "NOT there yet: fix the gaps, then run ref_compare again", gaps, matches: good, console_errors: L.console, clone_pictures: [...L.shots, ...M.shots].map((f) => f.split("/").pop()!),
    next: gaps.length ? "Fix each gap in the files you own, then ref_compare again. LOOK at clone-light-section-NN.png next to the reference's desktop-light-section-NN.png (Read)." : "Structure matches. Look at the pictures once more for spacing and polish, then report." };
}
