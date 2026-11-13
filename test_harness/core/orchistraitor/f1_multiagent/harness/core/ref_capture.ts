// `ref_capture`: REAL reference of a website for a "ditto" clone, made by the harness (no model call). A researcher's WebFetch only returns a model-written SUMMARY (no CSS, no colours, no look);
// this saves what a builder actually needs into run_test/_ref/<name>/: page.html (raw), styles.css (the linked stylesheets), screenshots (desktop light, desktop dark, mobile: builders can LOOK at the png with Read),
// and REF.md = design tokens (css variables, top colours, fonts), the section outline, nav / footer links, animations, theme support. The builder replicates layout, tokens and motion; brand and text are renamed / original.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readdirSync, rmSync } from "node:fs";
import { par, browse, type Outline } from "./browse.ts";
import { buildStore, initStore } from "./ref_store.ts";
import { refAssets } from "./ref_assets.ts";

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";
const strip = (h: string) => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<svg[\s\S]*?<\/svg>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const top = (m: Map<string, number>, n: number) => [...m].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${k} (${v})`);

/** CONTACT SHEETS: 4 section pictures side by side in ONE picture (overview-1.png ...), so an agent looks at 3 images instead of 12 (each Read costs time and context; the single section pictures stay for detail). */
export async function contactSheets(pics: string): Promise<number> {
  const files = readdirSync(pics).filter((f) => /^desktop-light-section-\d+\.png$/.test(f)).sort(), groups: string[][] = []; for (let i = 0; i < files.length; i += 4) groups.push(files.slice(i, i + 4));
  if (!groups.length) return 0;
  const html = join(pics, "_sheets.html");   // ONE page with every sheet stacked, ONE browser, no scrolling (the images are local): ~2 s for any number of sheets
  writeFileSync(html, `<body style="margin:0;background:#8a8f98;width:1440px">${groups.map((g, k) => `<div id="s${k + 1}" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;background:#8a8f98;margin-bottom:12px">${g.map((f) => `<div style="position:relative"><img src="${f}" style="width:100%;display:block"><b style="position:absolute;left:6px;top:6px;background:#000c;color:#fff;font:700 18px sans-serif;padding:2px 8px;border-radius:6px">#${Number(/(\d+)/.exec(f)![1])}</b></div>`).join("")}</div>`).join("")}</body>`);
  try { await browse({ url: "file://" + html, outDir: pics, settleMs: 400, steps: groups.map((_, k) => ({ shot: `overview-${k + 1}.png`, selector: `#s${k + 1}` })) }); } finally { rmSync(html, { force: true }); }
  return groups.length;
}
export async function refCapture(o: { url: string; dir: string; name: string }): Promise<Record<string, unknown>> {
  const base = new URL(o.url); mkdirSync(o.dir, { recursive: true }); initStore(o.dir); const pics = join(o.dir, "pictures");
  let html = ""; try { const r = await fetch(o.url, { headers: { "user-agent": UA }, redirect: "follow", signal: AbortSignal.timeout(20_000) }); if (!r.ok) return { ok: false, reason: `HTTP ${r.status} for ${o.url}` }; html = await r.text(); } catch (e) { return { ok: false, reason: "could not fetch " + o.url + ": " + String((e as Error).message).slice(0, 100) }; }
  writeFileSync(join(o.dir, "raw", "page.html"), html);
  // stylesheets (max 4 files, 1.5 MB)
  const hrefs = [...html.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]*>/gi)].map((m) => /href=["']([^"']+)["']/.exec(m[0])?.[1]).filter((x): x is string => !!x).map((h) => new URL(h, base).href).filter((h) => !/fonts\.googleapis/.test(h)).slice(0, 4);
  let css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join("\n");
  for (const h of hrefs) { try { const r = await fetch(h, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(15_000) }); if (r.ok) css += `\n/* ${h} */\n` + (await r.text()).slice(0, 1_000_000); } catch { /* optional */ } }
  writeFileSync(join(o.dir, "raw", "styles.css"), css);
  // tokens
  const vars = new Map<string, string>(); for (const m of css.matchAll(/(--[\w-]+)\s*:\s*([^;}{]{1,60})[;}]/g)) if (!vars.has(m[1]!)) vars.set(m[1]!, m[2]!.trim());
  const colors = new Map<string, number>(); for (const m of css.matchAll(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|rgba?\([^)]{5,30}\)/g)) { const c = m[0].toLowerCase(); colors.set(c, (colors.get(c) ?? 0) + 1); }
  const fonts = new Map<string, number>(); for (const m of css.matchAll(/font-family\s*:\s*([^;}{]{3,90})/g)) { const f = m[1]!.split(",")[0]!.replace(/["']/g, "").trim(); if (f && !/^(var|inherit)/.test(f)) fonts.set(f, (fonts.get(f) ?? 0) + 1); }
  const gfonts = [...html.matchAll(/fonts\.googleapis\.com\/css2?\?family=([^"'&]+)/g)].map((m) => decodeURIComponent(m[1]!).replace(/\+/g, " ")).slice(0, 3);
  const keyframes = [...new Set([...css.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1]!))].slice(0, 15);
  const radius = new Map<string, number>(); for (const m of css.matchAll(/border-radius\s*:\s*([\d.]+(?:px|rem))/g)) radius.set(m[1]!, (radius.get(m[1]!) ?? 0) + 1);
  const themed = /prefers-color-scheme\s*:\s*dark/.test(css) ? "prefers-color-scheme: dark" : /\.dark\b|\[data-theme|data-mode/.test(css + html) ? "class / attribute switch (.dark or data-theme)" : "no dark theme found";
  const hasToggle = /theme[-_ ]?toggle|toggle[-_ ]?theme|dark[-_ ]?mode/i.test(html);
  const anims = [/transition\s*:/.test(css) ? "hover/transition effects" : "", keyframes.length ? `@keyframes (${keyframes.length})` : "", /IntersectionObserver|data-aos|reveal|fade-in|scroll-?trigger/i.test(html) ? "scroll reveal" : "", /backdrop-filter/.test(css) ? "backdrop blur" : "", /gradient/.test(css) ? "gradients" : ""].filter(Boolean);
  // structure
  const head = (html.match(/<header[\s\S]*?<\/header>/i) ?? html.match(/<nav[\s\S]*?<\/nav>/i) ?? [html.slice(0, 6000)])[0], nav = [...head.matchAll(/<a[^>]+href=["']([^"'#][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)].map((m) => `${strip(m[2]!).slice(0, 30)} -> ${m[1]}`).filter((x) => !x.startsWith(" ->")).slice(0, 14);
  const foot = (html.match(/<footer[\s\S]*?<\/footer>/i) ?? [""])[0], footLinks = [...foot.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].map((m) => strip(m[2]!).slice(0, 26)).filter(Boolean).slice(0, 24);
  const heads = [...html.matchAll(/<(h[1-3])[^>]*>([\s\S]*?)<\/\1>/gi)].map((m) => `${m[1]}: ${strip(m[2]!).slice(0, 70)}`).filter((x) => x.length > 5).slice(0, 40);
  const title = strip((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) ?? ["", ""])[1]!), desc = (/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i.exec(html) ?? [])[1] ?? "";
  // a REAL browser looks at it (CDP): scrolls through, then one picture per section (desktop light + dark) and a mobile page, plus the outline of every section's components
  const [L, D, M] = await par([() => browse({ url: o.url, outDir: pics, scheme: "light", sectionShots: 10, tag: "desktop-light" }), () => browse({ url: o.url, outDir: pics, scheme: "dark", sectionShots: 0, steps: [{ shot: "desktop-dark.png" }] }), () => browse({ url: o.url, outDir: pics, scheme: "light", mobile: true, steps: [{ shot: "mobile.png" }] })]);
  const nSheets = await contactSheets(pics).catch(() => 0);
  const ol: Outline | undefined = L.outline; if (ol) writeFileSync(join(o.dir, "outline.json"), JSON.stringify(ol, null, 1));
  const a = L.shots.length > 0, b = D.ok, c = M.ok, secs = ol?.sections ?? [];
  const secLines = secs.map((x) => `- #${x.i + 1} <${x.tag}${x.id ? " #" + x.id : ""}> y=${x.y} h=${x.h} | "${x.heading}" (${x.h_size}/${x.h_weight}) | bg ${x.bg} | ${x.cards ? x.cards + " cards" : "no card grid"}${x.buttons.length ? " | buttons: " + x.buttons.slice(0, 3).join(" / ") : ""} | ${x.images} icons/images | ${x.forms ? "form" : ""}${x.animated ? " | animated" : ""}${x.radius && x.radius !== "0px" ? " | radius " + x.radius : ""}  -> pictures/desktop-light-section-${String(x.i + 1).padStart(2, "0")}.png`).join("\n");
  const md = `# Reference: ${o.url} (captured by the harness, not a model summary)
Use it as the LOOK to match: layout, spacing, type scale, colours, motion, theme behaviour. The brand name is renamed and every text is written fresh (original copy). LOOK at the pictures with Read (folder pictures/): FIRST overview-1.png ... (contact sheets: 4 sections each, numbered #N like the list below; ${nSheets} of them: 3 Reads instead of 12), then a single desktop-light-section-NN.png only where you need detail; desktop-light-full.png (whole page) (ONE PICTURE PER SECTION, the list below says which is which), desktop-dark.png and mobile.png (FIRST SCREEN only: fast, the colours and the phone header; the light contact sheets carry the layout). The store is organised: STORE.md (index), MAP.md (mind map), assets/ (real images by role), layouts/ and briefs/ (lookup agent).

- title: ${title} | description: ${desc.slice(0, 160)}
- theme: ${themed}${hasToggle ? "; has a theme toggle button" : ""}
- fonts: ${[...top(fonts, 4), ...gfonts.map((g) => "google: " + g)].join("; ") || "system"}
- top colours: ${top(colors, 12).join(", ")}
- radius: ${top(radius, 4).join(", ")}
- css variables (first 24): ${[...vars].slice(0, 24).map(([k, v]) => `${k}:${v}`).join("; ")}
- motion: ${anims.join(", ") || "none found"}${keyframes.length ? " | keyframes: " + keyframes.join(", ") : ""}
- computed: body font ${ol?.theme.font ?? "?"}, text ${ol?.theme.color ?? "?"}, page bg ${ol?.theme.bg ?? "?"}, button/accent bg ${ol?.theme.accent ?? "?"}, ${secs.length} sections, page height ${ol?.doc_h ?? "?"}px, scroll-reveal: ${ol?.scrollReveal ? "yes" : "no"}
## Sections, top to bottom (what a person sees scrolling down: build ALL of them, same order and components)
${secLines || "(none measured)"}
## Header links
${nav.map((x) => "- " + x).join("\n") || "- (none found)"}
## Footer links
${footLinks.join(" | ") || "(none found)"}
## Headings, top to bottom
${heads.map((x) => "- " + x).join("\n")}
`;
  writeFileSync(join(o.dir, "REF.md"), md);
  const as = await refAssets({ dir: o.dir, url: o.url }) as { downloaded?: number }; buildStore(o.dir, o.name);   // the store is complete at once: assets by role, MAP.md (mind map), STORE.md (index)
  return { ok: true, browser: L.via === "connected" ? "the connected Chrome (visible)" : "the private headless Chrome (invisible)" + (L.console.find((x) => /does not answer/.test(x)) ? ": the connected browser does not answer" : ""), dir: o.dir.split("/run_test/").pop() ? "run_test/" + o.dir.split("/run_test/").pop() : o.dir, store: ["STORE.md (index, start here)", "MAP.md (mind map)", "REF.md", "outline.json", `pictures/ (${L.shots.length + D.shots.length + M.shots.length})`, `assets/ (${as.downloaded ?? 0} real files by role + assets.json)`, "raw/page.html", "raw/styles.css", "layouts/ and briefs/ (lookup agent)"], title, theme: themed, fonts: top(fonts, 3), colors: top(colors, 6), motion: anims, header_links: nav.length, sections: secs.length, section_list: secs.map((x) => `#${x.i + 1} ${x.heading || x.tag} (${x.cards ? x.cards + " cards" : x.buttons.length ? "cta" : "content"})`), headings: heads.length,
    next: "Read REF.md and LOOK at desktop-light.png (Read shows images). Then: proto_init --kind site with the nav of the reference, and builders replicate the look with their own text. A builder may run ref_capture on its own preview URL to compare." };
}
