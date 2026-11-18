// `site_audit`: the same REAL browser that studies a reference now checks OUR OWN website and lists what to improve (no model call): meta, headings, images without alt, links / buttons without a name, dead links and unknown routes,
// text contrast (WCAG), tiny text, tap targets and horizontal overflow on a phone, content that stays hidden, form labels, oversized images, too many fonts, console errors. Every page of a kit site (proto.json) is visited,
// desktop and mobile. Output: run_test/_audit/<name>/AUDIT.md (prioritised, with a fix hint each) + audit.json and a score.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { browse } from "./browse.ts";
import { smokeRoutes } from "./preview.ts";

const AUDIT_JS = `(() => {
  const issues = [], add = (sev, what, fix, n = 1) => issues.push({ sev, what, fix, n });
  const vis = (e) => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0.05; };
  const T = (e, n = 30) => (e.innerText || e.getAttribute('aria-label') || e.alt || '').replace(/\\s+/g, ' ').trim().slice(0, n);
  const cv = document.createElement('canvas'); cv.width = cv.height = 1; const cx = cv.getContext('2d', { willReadFrequently: true });   // the BROWSER normalises any css colour (rgb, color(srgb ..), color-mix results, lab, oklch ...): a hand-written parser misread color-mix() as 'unknown' and reported a button that passes (5.3:1) as 1.0:1
  const rgba = (c) => { try { cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; } catch (e) { return null; } };
  const lum = (c) => { const p = rgba(c); if (!p) return null; const f = p.slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return { l: 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2], a: p[3] }; };
  const bgOf = (e) => { for (let p = e; p; p = p.parentElement) { const st = getComputedStyle(p); if (st.backgroundImage && st.backgroundImage !== 'none') return null; const l = lum(st.backgroundColor); if (l && l.a > 0.9) return l.l; } return 1; };   // null = a gradient / picture is behind the text: its contrast cannot be measured from colours, do not guess
  if (!document.title || document.title.trim().length < 4) add('high', 'no meaningful <title>', 'Set a descriptive title (50-60 characters) on every page.');
  if (!document.querySelector('meta[name=viewport]')) add('high', 'no viewport meta', 'Add <meta name="viewport" content="width=device-width,initial-scale=1">.');
  if (!document.querySelector('meta[name=description]')) add('low', 'no meta description', 'Add <meta name="description"> (a clear 120-160 character summary).');
  if (!document.documentElement.lang) add('medium', 'the <html> element has no lang attribute', 'Add lang="en" (screen readers and search need it).');
  const hs = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(vis), h1 = hs.filter((h) => h.tagName === 'H1').length;
  if (h1 !== 1) add('medium', h1 === 0 ? 'the page has no h1' : 'the page has ' + h1 + ' h1 headings', 'Exactly one h1 per page, the page title.');
  let prev = 0, skips = 0; for (const h of hs) { const l = +h.tagName[1]; if (prev && l > prev + 1) skips++; prev = l; } if (skips) add('low', 'heading levels are skipped (' + skips + 'x, e.g. h2 -> h4)', 'Keep heading levels in order.', skips);
  const noAlt = [...document.images].filter((i) => !i.hasAttribute('alt') && vis(i)); if (noAlt.length) add('medium', noAlt.length + ' image(s) without alt text', 'Add alt="..." (alt="" for pure decoration).', noAlt.length);
  const noName = [...document.querySelectorAll('a[href], button')].filter((e) => vis(e) && !T(e) && !e.getAttribute('aria-label') && !e.getAttribute('title') && !e.querySelector('img[alt]:not([alt=""])')); if (noName.length) add('medium', noName.length + ' link(s) / button(s) with no text or aria-label (icon only)', 'Give icon-only controls an aria-label.', noName.length);
  const dead = [...document.querySelectorAll('a')].filter((a) => ['#', '', 'javascript:void(0)'].includes((a.getAttribute('href') || '#').trim()) && vis(a)); if (dead.length) add('high', dead.length + ' dead link(s) (href="#" or empty): ' + dead.slice(0, 3).map((a) => '"' + T(a, 20) + '"').join(', '), 'Every link goes to a real page or becomes a button with an action.', dead.length);
  const unl = [...document.querySelectorAll('input:not([type=hidden]):not([type=submit]):not([type=button]), textarea, select')].filter((i) => vis(i) && !i.getAttribute('aria-label') && !i.getAttribute('placeholder') && !(i.id && document.querySelector('label[for="' + i.id + '"]')) && !i.closest('label')); if (unl.length) add('medium', unl.length + ' form field(s) without a label', 'Add a <label for> or aria-label.', unl.length);
  // contrast: the worst few text elements
  const worst = []; for (const e of [...document.querySelectorAll('p,a,span,li,h1,h2,h3,h4,button,td,label,small')].slice(0, 900)) { if (!vis(e)) continue; const own = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 2); if (!own) continue; const s = getComputedStyle(e), fg = lum(s.color), bgl = bgOf(e); if (!fg || bgl === null) continue; const l1 = Math.max(fg.l, bgl), l2 = Math.min(fg.l, bgl), ratio = (l1 + 0.05) / (l2 + 0.05), big = parseFloat(s.fontSize) >= 24 || (parseFloat(s.fontSize) >= 18.66 && +s.fontWeight >= 700); if (ratio < (big ? 3 : 4.5)) worst.push({ ratio, t: T(e, 24) }); }
  if (worst.length) { worst.sort((a, b) => a.ratio - b.ratio); add(worst[0].ratio < 3 ? 'high' : 'medium', worst.length + ' text element(s) with low contrast (worst ' + worst[0].ratio.toFixed(1) + ':1 on "' + worst[0].t + '", WCAG wants 4.5:1)', 'Darken the text or lighten the background (muted / placeholder greys are the usual cause).', worst.length); }
  const tiny = [...document.querySelectorAll('p,a,span,li,td,label')].filter((e) => vis(e) && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 2) && parseFloat(getComputedStyle(e).fontSize) < 12); if (tiny.length) add('low', tiny.length + ' text element(s) under 12px', 'Keep body text at 14px or more.', tiny.length);
  const over = document.documentElement.scrollWidth > innerWidth + 1; if (over) { let w = null, mx = 0; for (const e of document.querySelectorAll('body *')) { const r = e.getBoundingClientRect(); if (r.right > innerWidth + 1 && r.width > 0 && vis(e) && r.right > mx) { mx = r.right; w = e; } } add('high', 'horizontal scrolling at ' + innerWidth + 'px wide' + (w ? ' (widest: <' + w.tagName.toLowerCase() + (w.className ? '.' + String(w.className).split(' ')[0] : '') + '>)' : ''), 'Make that element shrink (max-width:100%, flex-wrap, overflow-wrap).'); }
  if (innerWidth < 600) { const small = [...document.querySelectorAll('a[href], button, input, select')].filter((e) => { if (!vis(e)) return false; const r = e.getBoundingClientRect(); return r.height < 32 || r.width < 32; }).filter((e) => T(e).length < 40); if (small.length > 2) add('medium', small.length + ' tap target(s) smaller than 32px on a phone', 'Give buttons and links at least 40x40px of touch area.', small.length); }
  const hidden = [...document.querySelectorAll('.reveal, [data-aos]')].filter((e) => +getComputedStyle(e).opacity < 0.1); if (hidden.length) add('medium', hidden.length + ' element(s) stay invisible after scrolling (reveal animation never fires)', 'Check the reveal observer / class; never leave content at opacity 0.', hidden.length);
  const big = [...document.images].filter((i) => vis(i) && i.naturalWidth > i.clientWidth * 2.6 && i.naturalWidth > 1200); if (big.length) add('low', big.length + ' image(s) far larger than shown (slow page)', 'Serve the displayed size (srcset / resize).', big.length);
  const fams = new Set([...document.querySelectorAll('h1,h2,p,a,button,li')].slice(0, 200).map((e) => getComputedStyle(e).fontFamily.split(',')[0].replace(/["']/g, ''))); if (fams.size > 3) add('low', fams.size + ' different font families in use', 'Two families (heading + body) read as one brand.');
  return { issues, title: document.title, h: document.documentElement.scrollHeight };
})()`;

type Issue = { sev: "high" | "medium" | "low"; what: string; fix: string; n: number };
export async function siteAudit(o: { base: string; routes: { id: string; file?: string }[]; outDir: string; name: string; projectDir?: string }): Promise<Record<string, unknown>> {
  mkdirSync(o.outDir, { recursive: true });
  const href = (id: string, base: string) => (/\.html$/.test(base) ? `${base}#/${id}` : id ? `${base}/#/${id}` : base), all = new Map<string, { sev: Issue["sev"]; fix: string; pages: Set<string>; n: number }>(), consoleErrs = new Set<string>();
  const run = async (id: string, mobile: boolean) => { const r = await browse({ url: href(id, o.base), outDir: o.outDir, mobile, scheme: "light", prime: true, steps: [{ eval: AUDIT_JS }] }); return { id, mobile, r }; };
  const jobs = o.routes.length ? o.routes : [{ id: "" }]; const results: Awaited<ReturnType<typeof run>>[] = [];
  for (let i = 0; i < jobs.length; i += 3) results.push(...(await Promise.all(jobs.slice(i, i + 3).flatMap((j) => [run(j.id, false), run(j.id, true)]))));   // a few pages at a time
  let checked = 0;
  for (const { id, mobile, r } of results) {
    if (!r.ok) { add("high", `the page did not open (${r.reason})`, "Fix the load error first.", id, mobile); continue; }
    checked++; r.console.forEach((c) => consoleErrs.add(c));
    const out = (r.results[0] as { eval?: { issues: Issue[] } } | undefined)?.eval; for (const it of out?.issues ?? []) add(it.sev, it.what, it.fix, id, mobile);
  }
  function add(sev: Issue["sev"], what: string, fix: string, id: string, mobile: boolean) { const key = what.replace(/\d+(\.\d+)?/g, "N"); const e = all.get(key) ?? { sev, fix, pages: new Set<string>(), n: 0 }; e.pages.add(`${id ? "#/" + id : "/"}${mobile ? " (mobile)" : ""}`); e.n++; if (!all.has(key)) all.set(key, e); (e as { what?: string }).what ??= what; }
  // kit sites: links that lead nowhere / detail pages not found (the route check of a kit prototype)
  let linkProblems: { route: string; problems: string[] }[] = [];
  if (o.routes.length) { try { linkProblems = await smokeRoutes(o.base, o.routes, 6_000, o.routes.map((r) => r.id)); } catch { /* optional */ } }
  for (const lp of linkProblems) for (const p of lp.problems) { const key = p.replace(/\d+/g, "N"); const e = all.get(key) ?? { sev: /JavaScript|dead|not exist|not found|stub/.test(p) ? "high" as const : "medium" as const, fix: "Fix the page named here (see the page list).", pages: new Set<string>(), n: 0 }; e.pages.add(lp.route.split(" ")[0]!); e.n++; (e as { what?: string }).what ??= p; all.set(key, e); }
  const list = [...all.values()].map((e) => ({ ...e, what: (e as { what?: string }).what ?? "", pages: [...e.pages] })), by = (s: Issue["sev"]) => list.filter((x) => x.sev === s).sort((a, b) => b.pages.length - a.pages.length);
  const score = Math.max(0, 100 - by("high").length * 9 - by("medium").length * 4 - by("low").length * 1);
  const fmt = (l: typeof list) => l.map((x) => `- **${x.what}**${x.pages.length > 1 ? ` (on ${x.pages.length} pages: ${x.pages.slice(0, 4).join(", ")}${x.pages.length > 4 ? " ..." : ""})` : ` (${x.pages[0] ?? "page"})`}\n  - fix: ${x.fix}`).join("\n") || "- none";
  const md = `# Site audit: ${o.name}
Checked ${checked} page view(s) (${jobs.length} page(s), desktop + phone) in a real browser. Score **${score}/100** · ${by("high").length} high · ${by("medium").length} medium · ${by("low").length} low.${consoleErrs.size ? `\nConsole errors: ${[...consoleErrs].join(" | ")}` : ""}

## High (fix first)
${fmt(by("high"))}

## Medium
${fmt(by("medium"))}

## Low (polish)
${fmt(by("low"))}
`;
  writeFileSync(join(o.outDir, "AUDIT.md"), md); writeFileSync(join(o.outDir, "audit.json"), JSON.stringify({ score, issues: list }, null, 1));
  return { ok: true, browser: results.some((x) => x.r.via === "connected") ? "connected Chrome" : "private headless Chrome", score, high: by("high").length, medium: by("medium").length, low: by("low").length, pages_checked: checked, top: [...by("high"), ...by("medium")].slice(0, 6).map((x) => `${x.sev}: ${x.what} [${x.pages.slice(0, 2).join(", ")}]`), report: `run_test/_audit/${o.name}/AUDIT.md`, next: list.length ? "Hand each HIGH and MEDIUM item to the builder that owns the page (the page list tells which file), then run site_audit again." : "Clean: nothing to improve in what the audit checks." };
}
export const projectRoutes = (dir: string): { id: string; file?: string }[] => { try { return JSON.parse(readFileSync(join(dir, "proto.json"), "utf8")).routes; } catch { return []; } };
export { existsSync };
