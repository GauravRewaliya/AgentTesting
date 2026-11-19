// REAL BROWSER for agents (Chrome DevTools Protocol, no extension, no model call): open a page, emulate light / dark / mobile, scroll, click, take screenshots (viewport, full page, one section), read computed styles
// and an OUTLINE of the page (every section: heading, background, text colour, font, components: cards, buttons, images, lists, forms, animations). This is what a person's eyes do; WebFetch gives a model-written summary.
// Used by `ref_capture` (study a reference site), `ref_compare` (does the clone match?) and `browse` (any steps). One Chrome per call, closed at the end: nothing is left running.
import { CHROME_PREFIX, SOFT_GL } from "./chrome_flags.ts";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { attachedEndpoint, chromeBin, type Tab } from "./browser_conn.ts";
export { chromeBin };
export const attached = () => !!attachedEndpoint();
/** run browser jobs in parallel in the private headless Chrome, one after another in a connected (visible) browser (background tabs get throttled) */
export async function par<T>(jobs: (() => Promise<T>)[]): Promise<T[]> { if (!attached()) return Promise.all(jobs.map((j) => j())); const r: T[] = []; for (const j of jobs) r.push(await j()); return r; }
export interface Section { i: number; tag: string; id: string; y: number; h: number; heading: string; headings: number; bg: string; color: string; font: string; h_size: string; h_weight: string; buttons: string[]; links: number; images: number; cards: number; lists: number; forms: number; inputs: number; animated: boolean; radius: string; text: string }
export interface Outline { url: string; title: string; theme: { scheme: string; bg: string; color: string; font: string; accent: string }; doc_h: number; sections: Section[]; nav: string[]; fonts: string[]; keyframes: string[]; scrollReveal: boolean; links: { text: string; href: string }[] }
export type Step = { /** change the size of the page (responsiveness): "390x844" a phone, "820x1180" a tablet, "1280x720" back to normal; the snapshot after it reports how the layout fits at that size */ viewport?: string; /** how long (ms) to wait for the target to exist and be clickable before the step counts as failed (default 4000: a page that is still loading is waited for, not failed) */ timeout?: number; /** list what a person can see and press, each with a ref "@e5": use that ref as the target of click / fill / type / hover / waitfor instead of guessing a selector (refs are valid until the page changes: take a new snapshot) */ snapshot?: boolean; /** go to another address in the SAME tab */ goto?: string; /** fill a form: { "#email": "a@b.c", "[name=pw]": "x" } (sets the value and fires input + change) */ fill?: Record<string, string>; /** type text into the element with this selector (needs `text`) */ type?: string; text?: string; /** press a key: Enter, Tab, Escape, ArrowRight, ArrowLeft, Space ... */ key?: string; /** wait until this selector exists (max 8 s) */ waitfor?: string; /** a NUMBERED step: it gets a number, a picture (auto-named NN_<name>.png) and a time in the video; any step with a name turns the report on. A step that fails is recorded and the run GOES ON (autopilot) */ /** a NUMBERED step: it gets a number, a picture (auto-named NN_<name>.png) and a time in the video; any step with a name turns the report on */ name?: string; shot?: string; full?: boolean; selector?: string; section?: number; scroll?: number; click?: string; wait?: number; eval?: string; outline?: boolean; hover?: string; clip?: { y: number; h: number }; /** make every random effect repeatable: replaces Math.random with a seeded generator from now on (petals, sparks, particles made AFTER this step are the same on every run), so two pictures of the same build can be compared. Use it as the first step of the quality picture script. */ seed?: number };

const OUTLINE_JS = `(() => {
  const vis = (e) => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.height > 40 && r.width > 200 && s.display !== 'none' && s.visibility !== 'hidden'; };
  let cands = [...document.querySelectorAll('header, section, footer, main > div, main > article, body > div > div, body > main > *')].filter(vis);
  cands = cands.filter((e) => !cands.some((o) => o !== e && o.contains(e)));
  const expand = (c, d) => { if (/^(SECTION|HEADER|FOOTER|ARTICLE)$/.test(c.tagName) || d > 4) return [c]; const kids = [...c.children].filter(vis); return kids.length >= 1 && (kids.length >= 2 || c.children.length === 1) ? kids.flatMap((k) => expand(k, d + 1)) : [c]; };
  cands = cands.flatMap((c) => expand(c, 0));
  if (cands.length < 2) cands = [...document.body.children].filter(vis);
  cands.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
  const T = (e, n) => (e.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, n);
  const sections = cands.slice(0, 24).map((e, i) => {
    const r = e.getBoundingClientRect(), s = getComputedStyle(e), h = e.querySelector('h1,h2,h3'), hs = h ? getComputedStyle(h) : null;
    let bg = s.backgroundColor, p = e; while ((bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') && p.parentElement) { p = p.parentElement; bg = getComputedStyle(p).backgroundColor; }
    const kids = [...e.querySelectorAll('*')].filter((k) => k.children.length >= 3 && [...k.children].every((c) => c.tagName === k.children[0].tagName && c.getBoundingClientRect().height > 60));
    const card = e.querySelector('[class*=card], article, li, [class*=item]');
    return { i, tag: e.tagName.toLowerCase(), id: e.id || '', y: Math.round(r.top + scrollY), h: Math.round(r.height), heading: h ? T(h, 90) : '', headings: e.querySelectorAll('h1,h2,h3,h4').length, bg, color: s.color, font: s.fontFamily.split(',')[0].replace(/["']/g, ''),
      h_size: hs ? hs.fontSize : '', h_weight: hs ? hs.fontWeight : '', buttons: [...e.querySelectorAll('a[class*=btn], button, a[class*=button]')].slice(0, 6).map((b) => T(b, 28)).filter(Boolean), links: e.querySelectorAll('a[href]').length, images: e.querySelectorAll('img, svg, picture, canvas').length,
      cards: kids.length ? Math.max(...kids.map((k) => k.children.length)) : 0, lists: e.querySelectorAll('ul, ol').length, forms: e.querySelectorAll('form').length, inputs: e.querySelectorAll('input, textarea, select').length,
      animated: [e, ...e.querySelectorAll('*')].slice(0, 120).some((k) => { const c = getComputedStyle(k); return (c.animationName && c.animationName !== 'none') || (c.transitionDuration && c.transitionDuration !== '0s'); }), radius: card ? getComputedStyle(card).borderRadius : '', text: T(e, 160) };
  });
  let accent = '', best = -1; for (const b of document.querySelectorAll('a[class*=btn], button, a[class*=button], [class*=cta]')) { const c = getComputedStyle(b).backgroundColor, m = /(\\d+),\\s*(\\d+),\\s*(\\d+)/.exec(c); if (!m) continue; const sat = Math.max(+m[1], +m[2], +m[3]) - Math.min(+m[1], +m[2], +m[3]); if (sat > best) { best = sat; accent = c; } }   // the brand colour = the most colourful filled button
  const kf = []; try { for (const sh of document.styleSheets) { try { for (const r of sh.cssRules) if (r.type === 7) kf.push(r.name); } catch (e) {} } } catch (e) {}
  return { url: location.href, title: document.title, theme: { scheme: matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light', bg: getComputedStyle(document.body).backgroundColor, color: getComputedStyle(document.body).color, font: getComputedStyle(document.body).fontFamily.split(',')[0].replace(/["']/g, ''), accent },
    doc_h: document.documentElement.scrollHeight, sections, nav: [...document.querySelectorAll('header a, nav a')].slice(0, 16).map((a) => T(a, 24) + ' -> ' + a.getAttribute('href')),
    fonts: [...new Set([...document.querySelectorAll('h1,h2,p,a,button')].slice(0, 60).map((e) => getComputedStyle(e).fontFamily.split(',')[0].replace(/["']/g, '')))].slice(0, 4), keyframes: [...new Set(kf)].slice(0, 20),
    scrollReveal: /IntersectionObserver|data-aos|reveal/i.test(document.documentElement.outerHTML.slice(0, 400000)), links: [...document.querySelectorAll('a[href]')].slice(0, 80).map((a) => ({ text: T(a, 30), href: a.getAttribute('href') })) };
})()`.replace("slice(0, 20),", "slice(0, 20),");

/** CLEAN CAPTURE: what gets in the way of a good picture is removed before it is taken: consent / cookie dialogs (accepted or dismissed), full-screen layers and modal backdrops, bottom bars, chat widgets, ad frames and promo bars; a sticky / fixed header is pinned in the flow so it shows ONCE at the top instead of repeating over every section; scroll locks are lifted. Returns what it did (never silent). */
const CLEAN_JS = `(() => {
  const removed = [], hide = (e, why) => { if (!e || e.dataset.cleaned) return; e.dataset.cleaned = '1'; e.style.setProperty('display', 'none', 'important'); removed.push(why + ': ' + String(e.id || e.className || e.tagName).slice(0, 36)); };
  const KW = /cookie|consent|gdpr|ccpa|onetrust|truste|cmp-|privacy-?banner|newsletter-?popup|popup|modal|overlay|backdrop|interstitial|paywall|adsbygoogle|advert|(^|[\\s_-])ads?([\\s_-]|$)|sponsor|intercom|drift|zendesk|crisp|hubspot|tawk|livechat|chat-?widget|notification-?bar|announcement|promo-?bar|smartbanner|beamer|launcher/i;
  for (const b of document.querySelectorAll('button, a, [role=button]')) { const t = (b.innerText || b.getAttribute('aria-label') || '').trim().toLowerCase(); if (t.length && t.length < 28 && /^(accept( all)?( cookies)?|agree|i agree|got it|allow all|ok|okay|reject all|decline|no thanks|dismiss|continue)$/.test(t) && b.closest('[class*=cookie],[id*=cookie],[class*=consent],[id*=consent],[class*=gdpr],[class*=cmp],[role=dialog],[aria-modal]')) { try { b.click(); removed.push('clicked: ' + t); } catch (e) {} } }
  for (const e of document.querySelectorAll('body *')) {
    const s = getComputedStyle(e); if (s.position !== 'fixed' && s.position !== 'sticky') continue; const r = e.getBoundingClientRect(); if (!r.width || !r.height) continue;
    const id = e.id + ' ' + e.className + ' ' + (e.getAttribute('aria-label') || ''), isHeader = e.matches('header, nav, [role=banner]') || (r.top <= 1 && r.height < 140 && /header|nav|topbar|menubar/i.test(id)), big = r.width * r.height > innerWidth * innerHeight * 0.25;
    if (isHeader) continue;
    if (KW.test(id) || e.matches('[aria-modal=true]')) hide(e, 'overlay'); else if (s.position === 'fixed' && big && (+s.zIndex || 0) > 10) hide(e, 'full-screen layer'); else if (s.position === 'fixed' && r.bottom >= innerHeight - 2 && r.height < 170 && r.width > innerWidth * 0.5) hide(e, 'bottom bar');
  }
  document.querySelectorAll('iframe[src*="doubleclick"], iframe[src*="googlesyndication"], iframe[id^="google_ads"], ins.adsbygoogle, [id^="div-gpt-ad"], iframe[src*="intercom"], iframe[title*="chat" i]').forEach((e) => hide(e, 'ad / chat frame'));
  for (const e of document.querySelectorAll('header, nav, [role=banner]')) { const s = getComputedStyle(e); if (s.position === 'fixed') { const r = e.getBoundingClientRect(); e.style.setProperty('position', 'absolute', 'important'); e.style.setProperty('top', r.top + scrollY + 'px', 'important'); removed.push('header pinned: ' + String(e.className).slice(0, 24)); } else if (s.position === 'sticky') { e.style.setProperty('position', 'relative', 'important'); removed.push('header unstuck: ' + String(e.className).slice(0, 24)); } }
  document.documentElement.style.setProperty('overflow', 'auto', 'important'); document.documentElement.style.setProperty('scroll-behavior', 'auto', 'important'); document.body.style.setProperty('overflow', 'visible', 'important'); document.body.style.removeProperty('filter');
  return removed.slice(0, 14);
})()`;


/** What is on screen that a person can press or fill, with a ref each (@e1, @e2 ...): the agent reads this once and acts by ref, no selector guessing. Refs are written into the page as data-qaref. */
const SNAP_JS = `(() => {
  document.querySelectorAll('[data-qaref]').forEach((e) => e.removeAttribute('data-qaref'));
  const vis = (e) => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 1 && r.height > 1 && s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0.05 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth && !e.closest('[hidden],[aria-hidden=true]'); };
  const label = (e) => ((e.getAttribute('aria-label') || e.innerText || e.getAttribute('title') || e.getAttribute('placeholder') || e.getAttribute('alt') || e.value || '') + '').replace(/\\s+/g, ' ').trim().slice(0, 50);
  const els = [...document.querySelectorAll('a[href],button,input,select,textarea,summary,[role=button],[role=link],[role=tab],[role=checkbox],[role=switch],[role=menuitem],[onclick],[tabindex]:not([tabindex="-1"])')].filter(vis);
  const seen = new Set(), lines = []; let n = 0;
  for (const e of els) { if (seen.has(e) || n >= 80) continue; seen.add(e); n++; e.setAttribute('data-qaref', 'e' + n);
    const t = e.tagName.toLowerCase(), role = e.getAttribute('role') || (t === 'input' ? 'input:' + (e.type || 'text') : t === 'a' ? 'link' : t), st = [e.disabled && 'disabled', e.checked && 'checked', e.getAttribute('aria-pressed') === 'true' && 'pressed', e.getAttribute('aria-selected') === 'true' && 'selected', e.id && '#' + e.id].filter(Boolean).join(' ');
    lines.push('@e' + n + ' ' + role + ' "' + label(e) + '"' + (st ? ' [' + st + ']' : '') + (/^(input|textarea|select)$/.test(t) && e.value ? ' value="' + String(e.value).slice(0, 30) + '"' : '')); }
  const iw = innerWidth, issues = [];
  const side = document.documentElement.scrollWidth - iw; if (side > 1) issues.push('page scrolls sideways by ' + side + 'px');
  const tag = (e) => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\\s+/)[0] : '');
  const over = [...document.querySelectorAll('body *')].filter((e) => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 1 && r.height > 1 && s.display !== 'none' && s.visibility !== 'hidden' && s.position !== 'fixed' && (r.right > iw + 2 || r.left < -2) && !e.closest('[aria-hidden=true],[hidden]'); }).slice(0, 4).map(tag); if (over.length) issues.push('sticks out of the screen: ' + over.join(', '));
  const clipped = [...document.querySelectorAll('body *')].filter((e) => { const s = getComputedStyle(e); return (s.overflow === 'hidden' || s.overflowX === 'hidden') && e.scrollWidth > e.clientWidth + 2 && e.clientWidth > 0 && (e.innerText || '').trim().length > 0 && s.textOverflow !== 'ellipsis'; }).slice(0, 4).map(tag); if (clipped.length) issues.push('text cut off in: ' + clipped.join(', '));
  const small = els.filter((e) => { const r = e.getBoundingClientRect(); return r.width < 24 || r.height < 24; }).length; if (small) issues.push(small + ' press targets smaller than 24px');
  const tiny = [...document.querySelectorAll('p,span,a,li,button,label,td')].filter((e) => vis(e) && (e.innerText || '').trim() && parseFloat(getComputedStyle(e).fontSize) < 11).length; if (tiny) issues.push(tiny + ' texts under 11px');
  const heads = [...document.querySelectorAll('h1,h2,h3')].filter(vis).slice(0, 5).map((h) => (h.innerText || '').trim().slice(0, 60));
  return { url: location.href, title: document.title, viewport: iw + 'x' + innerHeight, layout: issues.length ? issues : 'ok', headings: heads, elements: lines, more: Math.max(0, els.length - n) };
})()`;
const sel = (q: string) => (q.startsWith("@") ? `[data-qaref="${q.slice(1)}"]` : q);

class Cdp {
  private id = 0; private pend = new Map<number, (v: any) => void>(); private ws!: WebSocket;
  static async open(wsUrl: string) { const c = new Cdp(); c.ws = new WebSocket(wsUrl); await new Promise<void>((ok, bad) => { c.ws.onopen = () => ok(); c.ws.onerror = () => bad(new Error("cdp connect failed")); }); c.ws.onmessage = (m) => { const d = JSON.parse(String(m.data)); if (d.id && c.pend.has(d.id)) { c.pend.get(d.id)!(d); c.pend.delete(d.id); } }; return c; }
  send(method: string, params: Record<string, unknown> = {}): Promise<any> { const id = ++this.id; return new Promise((ok, bad) => { const t = setTimeout(() => bad(new Error("cdp timeout " + method)), 30_000); this.pend.set(id, (d) => { clearTimeout(t); d.error ? bad(new Error(method + ": " + d.error.message)) : ok(d.result); }); this.ws.send(JSON.stringify({ id, method, params })); }); }
  close() { try { this.ws.close(); } catch { /* done */ } }
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** The size of the person's screen, capped at 1280x720 (enough to see a page; larger only costs time and disk), even numbers; 1280x720 when it cannot be read. */
export const SCREEN = (() => { try { const m = String(spawnSync("sh", ["-c", "xdpyinfo 2>/dev/null | grep dimensions"], { encoding: "utf8" }).stdout).match(/(\d{3,5})x(\d{3,5})/); if (m) { let w = Number(m[1]), h = Number(m[2]); const k = Math.min(1, 1280 / w, 720 / h); w = Math.round(w * k / 2) * 2; h = Math.round(h * k / 2) * 2; if (w >= 800 && h >= 450) return { w, h }; } } catch { /* no X */ } return { w: 1280, h: 720 }; })();

/** a gap where the page did not change (waiting for the agent, a long wait) is shown for at most this long: the video PAUSES instead of idling */
const IDLE_CAP = 1.2;
/** The screencast frames of a run -> one .webm (VP8). Frame times come from Chrome, so the video plays at the real pace; a long idle gap is capped at 6 s so evidence stays short. */
function encodeVideo(frames: { t: number; file: string }[], outDir: string): { video?: string; note?: string; len?: number } {
  if (!frames.length) return { note: "no frames: the page never painted" };
  if (spawnSync("which", ["ffmpeg"]).status !== 0) return { note: "ffmpeg is not installed on this machine: no video (screenshots still work)" };
  const dur = (i: number) => Math.min(IDLE_CAP, Math.max(0.04, ((frames[i + 1]?.t ?? frames[i]!.t + 800) - frames[i]!.t) / 1000));
  const list = frames.map((f, i) => `file '${f.file}'\nduration ${dur(i).toFixed(3)}`).join("\n") + `\nfile '${frames[frames.length - 1]!.file}'\n`;
  const vdir = dirname(frames[0]!.file), lf = join(vdir, "list.txt"); writeFileSync(lf, list);
  const out = join(outDir, "session.webm"), seg = join(vdir, "seg.webm"), q = (x: string) => `'${x.replace(/'/g, "'\\''")}'`;
  // ONE video per folder: this script's frames become a segment that is APPENDED to session.webm (no frames exist while the agent thinks between scripts, so that time is simply not in the video: an automatic pause).
  // Encoded in the background (nice, 2 threads); `flock` keeps appends in order; the frames folder is removed at the end.
  const sh = `nice -n 10 ffmpeg -y -loglevel error -f concat -safe 0 -i ${q(lf)} -threads 2 -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2,fps=25" -c:v libvpx -deadline realtime -cpu-used 8 -crf 33 -b:v 2500k -pix_fmt yuv420p -f webm ${q(seg)} && flock ${q(join(outDir, ".enc.lock"))} sh -c ${q(`if [ -f ${q(out)} ]; then printf "file '%s'\\nfile '%s'\\n" ${q(out)} ${q(seg)} > ${q(join(vdir, "cat.txt"))} && ffmpeg -y -loglevel error -f concat -safe 0 -i ${q(join(vdir, "cat.txt"))} -c copy -f webm ${q(out + ".part")} && mv ${q(out + ".part")} ${q(out)}; else mv ${q(seg)} ${q(out)}; fi`)}; rm -rf ${q(vdir)}`;
  const marker = join(outDir, `.pending-${Date.now().toString(36)}-${process.pid}`); writeFileSync(marker, "");   // `tab close` waits until no marker is left (the encode runs niced in the background: 10 s on a quiet machine, over a minute on a busy one)
  spawn("sh", ["-c", `${sh}; rm -f ${q(marker)}`], { stdio: "ignore", detached: true }).unref();
  return { video: out, len: frames.reduce((n, _f, i) => n + dur(i), 0), note: "the video is being added to session.webm in the background; `tab close` waits until it is final and tells you. Do not record it again." };
}
/** One row of the QA report: what was done, what it looked like, and where it is in the video. */
export interface StepRow { n: number; name: string; action: string; ok: boolean; note?: string; shot?: string; wall: number; video_s?: number; /** the video file this row belongs to (a folder can hold several scripts) */ video?: string }
const slug = (x: string) => x.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 28) || "step";
/** seconds into the encoded video at which wall-clock time `ts` shows (same gap cap as encodeVideo) */
function videoAt(frames: { t: number }[], ts: number): number {
  let pos = 0; for (let i = 0; i < frames.length - 1 && frames[i + 1]!.t <= ts; i++) pos += Math.min(IDLE_CAP, Math.max(0.04, (frames[i + 1]!.t - frames[i]!.t) / 1000));
  return Math.round(pos * 10) / 10;
}
const esc = (x: string) => x.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
/** report.json + index.html next to the pictures: the video on top, every numbered step as a thumbnail that jumps the video to that moment. Plain files, opens by double-click. */
function writeReport(dir: string, title: string, rows: StepRow[], consoleErrors: string[], vtotal: number): string {
  const videos = [...new Set(rows.map((r) => r.video).filter((x): x is string => !!x))], video = videos[videos.length - 1];
  writeFileSync(join(dir, "report.json"), JSON.stringify({ title, videos, video_total: vtotal, steps: rows, console_errors: consoleErrors }, null, 1));
  const v = video ?? "", bad = rows.filter((r) => !r.ok).length;
  const fail = rows.find((r) => !r.ok), fps = 25, cell = (r: StepRow) => (r.video_s !== undefined ? `<a onclick="seek(${r.video_s},'${esc(r.video ?? '')}')">${mmss(r.video_s)}</a> <small>frame ${Math.round(r.video_s * fps)}</small>` : '<small class=mut>picture only (no video)</small>');
  const html = `<!doctype html><meta charset=utf-8><title>${esc(title)}</title><style>body{font:14px system-ui;margin:0;background:#111;color:#eee}main{max-width:1180px;margin:auto;padding:16px}video{width:100%;max-height:60vh;background:#000}table{border-collapse:collapse;width:100%;margin-top:12px}th{font-size:12px;color:#999;text-align:left;border-bottom:1px solid #444;padding:6px}td{border-bottom:1px solid #2a2a2a;padding:6px;vertical-align:middle}td img{width:200px;cursor:pointer;border:1px solid #444;display:block}.n{font:700 18px ui-monospace}.ok{color:#6c6}.no{color:#e66}a{color:#8cf;cursor:pointer}.mut{color:#888}</style><main><h1>${esc(title)}</h1><p>${rows.length} steps, <b class=${bad ? "no" : "ok"}>${bad ? bad + " failed" : "all passed"}</b>${v ? "" : " (no video)"}</p>${fail ? `<p class=no><b>Stopped at step ${fail.n}: ${esc(fail.name)}</b> (${esc(fail.note ?? "failed")}). Page state and console: failure.json</p>` : ""}${v ? `<video id=v controls src="${esc(v)}"></video>` : ""}${consoleErrors.length ? `<p class=no>console: ${esc(consoleErrors.join(" | "))}</p>` : ""}<table><tr><th>#<th>picture<th>step<th>result<th>video time / frame (${fps} fps)<th>note</tr>${rows.map((r) => `<tr><td class=n>${r.n}<td>${r.shot ? `<a href="${esc(r.shot)}" target=_blank><img src="${esc(r.shot)}" ${r.video_s !== undefined ? `onclick="seek(${r.video_s},'${esc(r.video ?? '')}');return false"` : ""}></a>` : ""}<td><b>${esc(r.name)}</b><br><small class=mut>${esc(r.action)}</small><td class=${r.ok ? "ok" : "no"}><b>${r.ok ? "OK" : "FAIL"}</b><td>${cell(r)}<td><small>${esc(r.note ?? "")}</small></tr>`).join("")}</table></main><script>function seek(t,f){var v=document.getElementById('v');if(v){if(f&&v.getAttribute('src')!==f){v.setAttribute('src',f);v.onloadedmetadata=function(){v.currentTime=t;v.play()}}else{v.currentTime=t;v.play()}scrollTo(0,0)}}</script>`;
  writeFileSync(join(dir, "index.html"), html);
  return join(dir, "index.html");
}
export interface BrowseOpts { url: string; outDir: string; width?: number; height?: number; scheme?: "light" | "dark"; mobile?: boolean; steps?: Step[]; settleMs?: number; sectionShots?: number; tag?: string; tab?: string; endpoint?: string; prime?: boolean; clean?: boolean; /** record the whole run (navigation, every step) as a .webm in outDir: Chrome screencast frames + ffmpeg */ video?: boolean; /** do not stop at the first failed step */ keepGoing?: boolean; /** false = no picture files at all (video and the page snapshot are the evidence); default true */ images?: boolean; /** keep-open tab: freeze the page when the script ends (a 3D page would otherwise render for ever and eat the CPU) and wake it at the start of the next one */ freeze?: boolean }
export async function browse(o: BrowseOpts): Promise<{ ok: boolean; reason?: string; failed?: { n: number; name: string; reason: string }; not_run?: number; report?: string; steps?: StepRow[]; video?: string; video_note?: string; shots: string[]; outline?: Outline; results: unknown[]; console: string[]; cleaned?: string[]; via?: "connected" | "headless" }> {
  mkdirSync(o.outDir, { recursive: true });
  const shots: string[] = [], results: unknown[] = [], logs: string[] = [];
  let ep = o.endpoint ?? attachedEndpoint(), reuse = false, ownTab = "", proc: ChildProcess | undefined, dir = "", cdp: Cdp | undefined, vdirOf = "";
  // a CONNECTED browser (a person can see it, it keeps its logins): its own new tab per task, or a tab the person already has open (o.tab)
  // the connected (visible) browser is an OPTIONAL extra: used only while it answers; otherwise the private headless Chrome does the work (same engine, same pictures). Nothing is ever started or restarted behind the person's back.
  if (ep) { try { await fetch(ep + "/json/version", { signal: AbortSignal.timeout(2500) }); } catch { logs.push(`the connected browser at ${ep} does not answer: the private headless Chrome did the work`); ep = undefined; } }
  const via: "connected" | "headless" = ep ? "connected" : "headless";
  const bin = chromeBin(); if (!ep && !bin) return { ok: false, reason: "no Chrome/Chromium on this machine and no connected browser", shots, results, console: logs };
  try {
    let wsUrl = "";
    if (ep) {
      if (o.tab) {
        const list = await (await fetch(ep + "/json/list")).json() as Tab[], q = o.tab.toLowerCase(), t = list.find((x) => x.type === "page" && (x.id === o.tab || (x.url + " " + x.title).toLowerCase().includes(q)));
        if (!t) return { ok: false, reason: `no open tab matches "${o.tab}" (browser_status lists the open tabs)`, shots, results, console: logs };
        wsUrl = t.webSocketDebuggerUrl!; reuse = true;
      } else { const nt = await (await fetch(ep + "/json/new?about:blank", { method: "PUT" })).json() as Tab; wsUrl = nt.webSocketDebuggerUrl!; ownTab = nt.id; }
    } else {
      dir = mkdtempSync(join(tmpdir(), "cdp-"));
      proc = spawn(CHROME_PREFIX[0]!, [...CHROME_PREFIX.slice(1), bin!, "--headless=new", "--no-sandbox", ...SOFT_GL, "--hide-scrollbars", "--allow-file-access-from-files", "--remote-debugging-port=0", `--user-data-dir=${dir}`, "about:blank"], { stdio: "ignore" });
      let port = 0; for (let i = 0; i < 80 && !port; i++) { await sleep(100); try { port = Number(readFileSync(join(dir, "DevToolsActivePort"), "utf8").split("\n")[0]); } catch { /* not yet */ } }
      if (!port) return { ok: false, reason: "Chrome did not start", shots, results, console: logs };
      wsUrl = ((await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()) as Tab[]).find((t) => t.type === "page")!.webSocketDebuggerUrl!;
    }
    cdp = await Cdp.open(wsUrl);
    const w = o.width ?? (o.mobile ? 390 : o.tab ? SCREEN.w : 1440), h = o.height ?? (o.mobile ? 844 : o.tab ? SCREEN.h : 900);   // a kept-open tab (agents) is 16:9, like a video should be
    await cdp.send("Page.enable"); await cdp.send("Runtime.enable");
    if (o.freeze) await cdp.send("Page.setWebLifecycleState", { state: "active" }).catch(() => 0);
    if (!reuse || (!!ep && ep !== attachedEndpoint())) { await cdp.send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: !!o.mobile }); await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: o.scheme ?? "light" }] }); }
    if (ownTab) await cdp.send("Page.bringToFront").catch(() => 0);   // a background tab of a visible browser is throttled
    await cdp.send("Network.enable").catch(() => 0);
    const frames: { t: number; file: string }[] = [], vdir = o.video ? mkdtempSync(join(tmpdir(), "bvid-")) : ""; vdirOf = vdir;   // screencast frames, written to disk as they arrive
    const ws = (cdp as unknown as { ws: WebSocket }).ws, prev = ws.onmessage!;
    ws.onmessage = (m) => { prev(m); try { const d = JSON.parse(String(m.data)); if (d.method === "Page.screencastFrame") { const file = join(vdir, `f${String(frames.length).padStart(5, "0")}.jpg`); writeFileSync(file, Buffer.from(d.params.data, "base64")); frames.push({ t: (d.params.metadata?.timestamp ?? Date.now() / 1000) * 1000, file }); cdp?.send("Page.screencastFrameAck", { sessionId: d.params.sessionId }).catch(() => 0); } if (d.method === "Runtime.exceptionThrown") logs.push("Uncaught " + (d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text).split("\n")[0].slice(0, 160)); if (d.method === "Runtime.consoleAPICalled" && d.params.type === "error") logs.push(d.params.args.map((a: any) => a.value ?? a.description ?? "").join(" ").slice(0, 160)); } catch { /* ignore */ } };
    if (o.video) await cdp.send("Page.startScreencast", { format: "jpeg", quality: 80, everyNthFrame: 1 });
    if (!reuse) { await cdp.send("Page.navigate", { url: o.url }); await sleep(900); }
    for (let i = 0; i < 40; i++) { const r = await cdp.send("Runtime.evaluate", { expression: "document.readyState" }); if (r.result.value === "complete") break; await sleep(250); }
    await sleep(o.settleMs ?? 1500);
    await cdp.send("Emulation.setScrollbarsHidden", { hidden: true }).catch(() => 0);   // no scrollbar in any picture (the private headless Chrome hides them by flag, a connected visible one does not)
    let cleaned: string[] | undefined;
    const ev = async (js: string) => { const r = await cdp!.send("Runtime.evaluate", { expression: js, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(String(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text).split("\n")[0]); return r.result.value; };
    if (!reuse && (o.clean === true || (o.clean !== false && !/^file:/.test(o.url)))) { try { cleaned = await ev(CLEAN_JS) as string[]; if (cleaned.length) await sleep(450); } catch { /* a page that cannot be cleaned is still captured */ } }   // not for a person's own open tab, not for our own files
    const save = async (name: string, clip?: { x: number; y: number; width: number; height: number }) => { const r = await cdp!.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: !!clip, ...(clip ? { clip: { ...clip, scale: 1 } } : {}) }); const f = join(o.outDir, name); writeFileSync(f, Buffer.from(r.data, "base64")); shots.push(f); return f; };
    // scroll through the page like a person: content that is revealed on scroll (IntersectionObserver) only exists once it was in view
    const prime = async () => { const dh = Math.min(Number(await ev("document.documentElement.scrollHeight")), 30000); for (let y = 0; y < dh; y += Math.round(h * 0.7)) { await ev(`window.scrollTo(0, ${y})`); await sleep(260); } await ev("window.scrollTo(0, 0)"); await sleep(500); };
    if (o.sectionShots || o.prime || (o.steps ?? []).some((x) => x.full)) await prime();
    let outline: Outline | undefined;
    const numbered = (o.steps ?? []).some((x) => x.name), rows: StepRow[] = [], vtotalPrior = (() => { try { return Number(JSON.parse(readFileSync(join(o.outDir, "report.json"), "utf8")).video_total) || 0; } catch { return 0; } })(), prior: StepRow[] = (() => { try { return numbered ? (JSON.parse(readFileSync(join(o.outDir, "report.json"), "utf8")).steps as StepRow[]) ?? [] : []; } catch { return []; } })();   // scripts of one folder ADD to it (numbers go on, nothing is overwritten); --clear starts the folder empty
    let vtotal = 0, stopped = false, notRun = 0, failed: { n: number; name: string; reason: string } | undefined;
    const later: { name: string; wall: number }[] = [];   // pictures taken from the video's own frames AFTER the run: a step never waits for its picture
    const row = async (name: string, action: string, ok: boolean, given?: string, note?: string) => {   // one numbered step: number, picture, wall-clock time (turned into a video time at the end)
      const n = prior.length + rows.length; let shot = given; if (o.images === false) { rows.push({ n, name, action, ok, note, wall: Date.now() }); return; }
      if (!shot) { const fromFrames = !!o.video && frames.length > 0; shot = `${String(n).padStart(2, "0")}_${slug(name)}.${fromFrames ? "jpg" : "png"}`; if (fromFrames) later.push({ name: shot, wall: Date.now() }); else await save(shot); }   // no screencast frame yet (or no video): a normal screenshot, never a missing picture
      rows.push({ n, name, action, ok, note, shot, wall: Date.now() });
    };
    const banner = (txt: string) => ev(`(() => { let b = document.getElementById('__qa_step'); if (!b) { b = document.createElement('div'); b.id = '__qa_step'; b.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:2147483647;background:rgba(0,0,0,.78);color:#fff;font:600 13px system-ui;padding:5px 10px;border-radius:6px;pointer-events:none'; document.documentElement.appendChild(b); } b.textContent = ${JSON.stringify(txt)}; })()`).catch(() => 0);
    if (numbered && !prior.length) await row("page loaded", "open " + o.url, true);
    const PICTURE_LIMIT = 2;   // with pictures OFF a session keeps TWO explicit pictures in all (across its scripts); the video shows the rest
    for (const st of o.steps ?? []) {
      if (st.shot && !(typeof st.shot === "string" && /^\d{2}_/.test(st.shot))) st.shot = `${String(prior.length + rows.length).padStart(2, "0")}_${slug(st.name ?? (typeof st.shot === "string" ? st.shot.replace(/\.\w+$/, "") : "picture"))}.png`;   // pictures are named by the tool (number + step name), never by the agent (a.png, b.png ...)
      if (st.shot && typeof st.shot === "string") { const stem = st.shot.replace(/^\d{2}_/, ""); try { for (const f of readdirSync(o.outDir)) if (f !== st.shot && /^\d{2}_/.test(f) && f.replace(/^\d{2}_/, "") === stem) rmSync(join(o.outDir, f), { force: true }); } catch { /* no folder yet */ } }   // a re-take of the same picture (same step name) REPLACES the first, so a picture taken too early can be redone for free
      let dropped = false; if (st.shot && o.images === false) { if (readdirSync(o.outDir).filter((f) => /^\d{2}_.+\.(png|jpe?g)$/.test(f)).length >= PICTURE_LIMIT) { st.shot = undefined as never; dropped = true; } }   // counted from the files really in the session folder (with pictures off a row records no picture)   // a further picture is not taken: the step still runs, its row says why
      if (numbered && st.name && !stopped) await banner(`${prior.length + rows.length}  ${st.name}`);
      if (stopped) { if (st.snapshot) results.push({ snapshot: await ev(SNAP_JS).catch(() => null) }); else notRun++; continue; }   // a step failed: nothing after it runs (the snapshot at the end still does)
      const clicks0 = results.length; let stepErr: string | undefined;
      try {
      if (st.scroll !== undefined) { await ev(`window.scrollTo(0, ${Number(st.scroll)})`); await sleep(700); }
      if (st.hover) { await ev(`(() => { const e = document.querySelector(${JSON.stringify(sel(st.hover))}); if (e) { e.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); } return !!e; })()`); await sleep(300); }
      if (st.click) {   // AUTO-WAIT: the target must exist, be visible and enabled; a page that is still loading is waited for (250 ms polls) instead of failing the step at once
        const q = JSON.stringify(sel(st.click)), probe = `(() => { const q = ${q}; let e = null; try { e = document.querySelector(q); } catch (x) {} if (!e) e = [...document.querySelectorAll('a,button,[role=button]')].find((x) => ((x.innerText || '') + ' ' + (x.getAttribute('aria-label') || '') + ' ' + (x.getAttribute('title') || '')).toLowerCase().includes(q.toLowerCase())); if (!e) return 'notfound'; const r = e.getBoundingClientRect(); if (e.disabled || e.getAttribute('aria-disabled') === 'true') return 'disabled'; if (r.width < 1 || r.height < 1 || getComputedStyle(e).visibility === 'hidden') return 'hidden'; e.click(); return 'clicked'; })()`;
        let state = "notfound"; const until = Date.now() + (st.timeout ?? 4000);
        for (;;) { state = String(await ev(probe)); if (state === "clicked" || Date.now() >= until) break; await sleep(250); }
        results.push({ click: st.click, found: state === "clicked", ...(state === "clicked" ? {} : { why: state }) }); await sleep(600);
      }
      if (st.viewport) { const m = String(st.viewport).match(/^(\d{3,4})x(\d{3,4})$/); if (!m) throw new Error(`viewport "${st.viewport}": use WIDTHxHEIGHT, for example 390x844`); await cdp.send("Emulation.setDeviceMetricsOverride", { width: Number(m[1]), height: Number(m[2]), deviceScaleFactor: 1, mobile: Number(m[1]) < 600 }); await sleep(600); results.push({ viewport: st.viewport }); }
      if (st.goto) { await cdp.send("Page.navigate", { url: st.goto }); await sleep(900); for (let i = 0; i < 40; i++) { const r = await cdp.send("Runtime.evaluate", { expression: "document.readyState" }); if (r.result.value === "complete") break; await sleep(250); } await sleep(o.settleMs ?? 1000); results.push({ goto: st.goto }); }
      if (st.snapshot) results.push({ snapshot: await ev(SNAP_JS) });
      if (st.waitfor) { let ok = false; for (let i = 0; i < 32 && !ok; i++) { ok = !!(await ev(`!!document.querySelector(${JSON.stringify(sel(st.waitfor))})`)); if (!ok) await sleep(250); } if (!ok) throw new Error(`waitfor ${st.waitfor}: never appeared`); }
      if (st.fill) for (const [q, v] of Object.entries(st.fill)) { const hit = await ev(`(() => { const e = document.querySelector(${JSON.stringify(sel(q))}); if (!e) return false; e.focus(); const set = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(e), 'value')?.set; set ? set.call(e, ${JSON.stringify(v)}) : (e.value = ${JSON.stringify(v)}); e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`); results.push({ fill: q, found: hit }); if (!hit) throw new Error(`fill ${q}: not found`); }
      if (st.type) { const hit = await ev(`(() => { const e = document.querySelector(${JSON.stringify(sel(st.type))}); if (!e) return false; e.focus(); return true; })()`); if (!hit) throw new Error(`type ${st.type}: not found`); await cdp.send("Input.insertText", { text: st.text ?? "" }); results.push({ type: st.type, chars: (st.text ?? "").length }); }
      if (st.key) { const K: Record<string, [string, number]> = { Enter: ["Enter", 13], Tab: ["Tab", 9], Escape: ["Escape", 27], ArrowRight: ["ArrowRight", 39], ArrowLeft: ["ArrowLeft", 37], ArrowUp: ["ArrowUp", 38], ArrowDown: ["ArrowDown", 40], Space: [" ", 32] }, [k, code] = K[st.key] ?? [st.key, 0]; for (const t of ["keyDown", "keyUp"]) await cdp.send("Input.dispatchKeyEvent", { type: t, key: k, code: k === " " ? "Space" : k, windowsVirtualKeyCode: code, text: t === "keyDown" && k.length === 1 ? k : undefined }); results.push({ key: st.key }); await sleep(300); }
      if (st.wait) await sleep(Math.min(st.wait, 10_000));
      if (st.seed !== undefined) { const sd = Math.trunc(Number(st.seed)) || 1; results.push({ seed: await ev(`(() => { let a = ${sd} >>> 0; Math.random = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; return ${sd}; })()`) }); }
      if (st.eval) results.push({ eval: await ev(st.eval) });
      if (st.outline) outline = await ev(OUTLINE_JS) as Outline;
      if (st.shot) {
        if (st.clip) await save(st.shot, { x: 0, y: st.clip.y, width: w, height: Math.min(st.clip.h, 2400) });
        else if (st.section !== undefined || st.selector) { const rect = await ev(st.selector ? `(() => { const e = document.querySelector(${JSON.stringify(st.selector)}); if (!e) return null; const r = e.getBoundingClientRect(); return { x: 0, y: Math.round(r.top + scrollY), width: innerWidth, height: Math.round(r.height) }; })()` : "null"); if (rect) await save(st.shot, { ...rect, height: Math.min(rect.height, 2400) }); }
        else if (st.full) { const dh = Math.min(Number(await ev("document.documentElement.scrollHeight")), 9000); await save(st.shot, { x: 0, y: 0, width: w, height: dh }); }
        else await save(st.shot);
      }
      } catch (e) { stepErr = String((e as Error).message).slice(0, 140); results.push({ error: stepErr, step: st.name ?? st.click ?? st.type ?? st.key ?? "step" }); }
      const clickRes = st.click ? results.slice(clicks0).find((r) => (r as { click?: string }).click !== undefined) as { found?: boolean } | undefined : undefined, stepOk = (clickRes ? !!clickRes.found : true) && !stepErr;
      if (!stepOk && !o.keepGoing) { stopped = true; failed = { n: prior.length + rows.length, name: st.name ?? (st.click ? `click ${st.click}` : st.fill ? "fill form" : st.type ? `type into ${st.type}` : st.key ? `key ${st.key}` : "step"), reason: stepErr ?? (clickRes as { why?: string } | undefined)?.why ? `target ${(clickRes as { why?: string }).why} even after waiting` : "not found on the page" }; }
      if (numbered && (st.name || st.click || stepErr || st.shot)) {
        const ok = stepOk;
        await row(st.name ?? (st.click ? `click ${st.click}` : st.shot ? `picture ${st.shot}` : "step"), st.click ? `click ${st.click}` : st.fill ? "fill form" : st.type ? `type into ${st.type}` : st.key ? `key ${st.key}` : st.eval ? "eval" : "look", ok, st.shot, ok ? (dropped ? `no picture: the limit of ${PICTURE_LIMIT} pictures per session (pictures off) is reached, the video shows it` : undefined) : stepErr ?? ((clickRes as { why?: string } | undefined)?.why ? `target ${(clickRes as { why?: string }).why} even after waiting` : "not found on the page"));
      }
    }
    if (o.sectionShots && !outline) outline = await ev(OUTLINE_JS) as Outline;
    if (o.sectionShots && outline) {   // one full-page shot + one picture per section (what a person scrolls through)
      const tag = o.tag ?? "page"; await ev("window.scrollTo(0, 0)");
      await save(`${tag}-full.png`, { x: 0, y: 0, width: w, height: Math.min(outline.doc_h, 9000) });
      for (const sec of outline.sections.slice(0, o.sectionShots)) await save(`${tag}-section-${String(sec.i + 1).padStart(2, "0")}.png`, { x: 0, y: sec.y, width: w, height: Math.min(sec.h, 2400) });
    }
    let video: string | undefined, video_note: string | undefined;
    if (o.video) { await cdp.send("Page.stopScreencast").catch(() => 0); await sleep(150); for (const l of later) { let f = frames[0]; for (const fr of frames) if (fr.t <= l.wall) f = fr; if (f) { const dst = join(o.outDir, l.name); copyFileSync(f.file, dst); shots.push(dst); } } const e = encodeVideo(frames, o.outDir); video = e.video; video_note = e.note; if (e.video) vdirOf = ""; if (video) { const base = vtotalPrior; for (const r of rows) { r.video_s = Math.round((base + videoAt(frames, r.wall)) * 10) / 10; r.video = "session.webm"; } vtotal = base + (e.len ?? 0); } }
    if (failed) {   // evidence for later, for people and for agents that were not there: what failed, the picture (the failed row's), the console, and the page as it was
      const snap = [...results].reverse().find((r) => (r as { snapshot?: unknown }).snapshot) as { snapshot?: unknown } | undefined;
      try { writeFileSync(join(o.outDir, "failure.json"), JSON.stringify({ failed, picture: rows.find((r) => r.n === failed!.n)?.shot, not_run: notRun, console: [...new Set(logs)], page: snap?.snapshot ?? null, at: new Date().toISOString() }, null, 1)); } catch { /* evidence is best effort */ }
    }
    const report = numbered ? writeReport(o.outDir, o.tag ?? "QA run", [...prior, ...rows], [...new Set(logs)].slice(0, 6), vtotal || vtotalPrior) : undefined;
    return { ok: !failed, reason: failed ? `step ${failed.n} "${failed.name}" failed: ${failed.reason}; ${notRun} later step(s) did NOT run (the page state is in the snapshot)` : undefined, failed, not_run: notRun, report, steps: numbered ? rows : undefined, video, video_note, shots, outline, results, console: [...new Set(logs)].slice(0, 6), cleaned, via };
  } catch (e) { return { ok: false, reason: String((e as Error).message).slice(0, 200), shots, results, console: logs }; }
  finally { if (o.freeze && cdp) await cdp.send("Page.setWebLifecycleState", { state: "frozen" }).catch(() => 0); cdp?.close(); proc?.kill("SIGKILL"); if (vdirOf) rmSync(vdirOf, { recursive: true, force: true }); if (dir) rmSync(dir, { recursive: true, force: true }); if (ownTab && ep) { await fetch(ep + "/json/close/" + ownTab).catch(() => 0); for (let i = 0; i < 12; i++) { const gone = await fetch(ep + "/json/list").then((r) => r.json() as Promise<Tab[]>).then((l) => !l.some((t) => t.id === ownTab)).catch(() => true); if (gone) break; await sleep(150); } } }   // the person's browser is left exactly as it was: wait until our tab is really gone
}
export { existsSync };

/** Wait until every background video encode under `root` is finished (no `.pending-*` marker left), at most `capMs`; then name the videos (path, MB). */
export async function waitVideos(root: string, capMs = 120_000): Promise<{ waited_s: number; pending: boolean; videos: { file: string; mb: number }[] }> {
  const { readdirSync, statSync } = await import("node:fs"), t0 = Date.now();
  const walk = (d: string, depth = 0, acc: { pending: string[]; videos: { file: string; mb: number; m: number }[] } = { pending: [], videos: [] }) => {
    try { for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) { if (depth < 3) walk(p, depth + 1, acc); } else if (e.name.startsWith(".pending-")) acc.pending.push(p); else if (e.name === "session.webm") { const st = statSync(p); acc.videos.push({ file: p, mb: Math.round(st.size / 1048576 * 10) / 10, m: st.mtimeMs }); } } } catch { /* gone */ }
    return acc;
  };
  let acc = walk(root); while (acc.pending.length && Date.now() - t0 < capMs) { await new Promise((r) => setTimeout(r, 500)); acc = walk(root); }
  return { waited_s: Math.round((Date.now() - t0) / 100) / 10, pending: acc.pending.length > 0, videos: acc.videos.filter((v) => Date.now() - v.m < 3_600_000).map(({ file, mb }) => ({ file, mb })) };
}
