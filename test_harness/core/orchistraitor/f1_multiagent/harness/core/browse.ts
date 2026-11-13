// REAL BROWSER for agents (Chrome DevTools Protocol, no extension, no model call): open a page, emulate light / dark / mobile, scroll, click, take screenshots (viewport, full page, one section), read computed styles
// and an OUTLINE of the page (every section: heading, background, text colour, font, components: cards, buttons, images, lists, forms, animations). This is what a person's eyes do; WebFetch gives a model-written summary.
// Used by `ref_capture` (study a reference site), `ref_compare` (does the clone match?) and `browse` (any steps). One Chrome per call, closed at the end: nothing is left running.
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { attachedEndpoint, chromeBin, type Tab } from "./browser_conn.ts";
export { chromeBin };
export const attached = () => !!attachedEndpoint();
/** run browser jobs in parallel in the private headless Chrome, one after another in a connected (visible) browser (background tabs get throttled) */
export async function par<T>(jobs: (() => Promise<T>)[]): Promise<T[]> { if (!attached()) return Promise.all(jobs.map((j) => j())); const r: T[] = []; for (const j of jobs) r.push(await j()); return r; }
export interface Section { i: number; tag: string; id: string; y: number; h: number; heading: string; headings: number; bg: string; color: string; font: string; h_size: string; h_weight: string; buttons: string[]; links: number; images: number; cards: number; lists: number; forms: number; inputs: number; animated: boolean; radius: string; text: string }
export interface Outline { url: string; title: string; theme: { scheme: string; bg: string; color: string; font: string; accent: string }; doc_h: number; sections: Section[]; nav: string[]; fonts: string[]; keyframes: string[]; scrollReveal: boolean; links: { text: string; href: string }[] }
export type Step = { shot?: string; full?: boolean; selector?: string; section?: number; scroll?: number; click?: string; wait?: number; eval?: string; outline?: boolean; hover?: string; clip?: { y: number; h: number } };

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

class Cdp {
  private id = 0; private pend = new Map<number, (v: any) => void>(); private ws!: WebSocket;
  static async open(wsUrl: string) { const c = new Cdp(); c.ws = new WebSocket(wsUrl); await new Promise<void>((ok, bad) => { c.ws.onopen = () => ok(); c.ws.onerror = () => bad(new Error("cdp connect failed")); }); c.ws.onmessage = (m) => { const d = JSON.parse(String(m.data)); if (d.id && c.pend.has(d.id)) { c.pend.get(d.id)!(d); c.pend.delete(d.id); } }; return c; }
  send(method: string, params: Record<string, unknown> = {}): Promise<any> { const id = ++this.id; return new Promise((ok, bad) => { const t = setTimeout(() => bad(new Error("cdp timeout " + method)), 30_000); this.pend.set(id, (d) => { clearTimeout(t); d.error ? bad(new Error(method + ": " + d.error.message)) : ok(d.result); }); this.ws.send(JSON.stringify({ id, method, params })); }); }
  close() { try { this.ws.close(); } catch { /* done */ } }
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface BrowseOpts { url: string; outDir: string; width?: number; height?: number; scheme?: "light" | "dark"; mobile?: boolean; steps?: Step[]; settleMs?: number; sectionShots?: number; tag?: string; tab?: string; endpoint?: string; prime?: boolean }
export async function browse(o: BrowseOpts): Promise<{ ok: boolean; reason?: string; shots: string[]; outline?: Outline; results: unknown[]; console: string[] }> {
  mkdirSync(o.outDir, { recursive: true });
  const shots: string[] = [], results: unknown[] = [], logs: string[] = [];
  let ep = o.endpoint ?? attachedEndpoint(), reuse = false, ownTab = "", proc: ChildProcess | undefined, dir = "", cdp: Cdp | undefined;
  // a CONNECTED browser (a person can see it, it keeps its logins): its own new tab per task, or a tab the person already has open (o.tab)
  if (ep) { try { await fetch(ep + "/json/version", { signal: AbortSignal.timeout(2500) }); } catch { logs.push(`the connected browser at ${ep} does not answer: used the private headless Chrome instead (browser_status shows it)`); ep = undefined; } }
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
      proc = spawn(bin!, ["--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars", "--allow-file-access-from-files", "--remote-debugging-port=0", `--user-data-dir=${dir}`, "about:blank"], { stdio: "ignore" });
      let port = 0; for (let i = 0; i < 80 && !port; i++) { await sleep(100); try { port = Number(readFileSync(join(dir, "DevToolsActivePort"), "utf8").split("\n")[0]); } catch { /* not yet */ } }
      if (!port) return { ok: false, reason: "Chrome did not start", shots, results, console: logs };
      wsUrl = ((await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()) as Tab[]).find((t) => t.type === "page")!.webSocketDebuggerUrl!;
    }
    cdp = await Cdp.open(wsUrl);
    const w = o.width ?? (o.mobile ? 390 : 1440), h = o.height ?? (o.mobile ? 844 : 900);
    await cdp.send("Page.enable"); await cdp.send("Runtime.enable");
    if (!reuse) { await cdp.send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: !!o.mobile }); await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: o.scheme ?? "light" }] }); }
    if (ownTab) await cdp.send("Page.bringToFront").catch(() => 0);   // a background tab of a visible browser is throttled
    await cdp.send("Network.enable").catch(() => 0);
    const ws = (cdp as unknown as { ws: WebSocket }).ws, prev = ws.onmessage!;
    ws.onmessage = (m) => { prev(m); try { const d = JSON.parse(String(m.data)); if (d.method === "Runtime.exceptionThrown") logs.push("Uncaught " + (d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text).split("\n")[0].slice(0, 160)); if (d.method === "Runtime.consoleAPICalled" && d.params.type === "error") logs.push(d.params.args.map((a: any) => a.value ?? a.description ?? "").join(" ").slice(0, 160)); } catch { /* ignore */ } };
    if (!reuse) { await cdp.send("Page.navigate", { url: o.url }); await sleep(900); }
    for (let i = 0; i < 40; i++) { const r = await cdp.send("Runtime.evaluate", { expression: "document.readyState" }); if (r.result.value === "complete") break; await sleep(250); }
    await sleep(o.settleMs ?? 1500);
    const ev = async (js: string) => { const r = await cdp!.send("Runtime.evaluate", { expression: js, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(String(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text).split("\n")[0]); return r.result.value; };
    const save = async (name: string, clip?: { x: number; y: number; width: number; height: number }) => { const r = await cdp!.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: !!clip, ...(clip ? { clip: { ...clip, scale: 1 } } : {}) }); const f = join(o.outDir, name); writeFileSync(f, Buffer.from(r.data, "base64")); shots.push(f); return f; };
    // scroll through the page like a person: content that is revealed on scroll (IntersectionObserver) only exists once it was in view
    const prime = async () => { const dh = Math.min(Number(await ev("document.documentElement.scrollHeight")), 30000); for (let y = 0; y < dh; y += Math.round(h * 0.7)) { await ev(`window.scrollTo(0, ${y})`); await sleep(260); } await ev("window.scrollTo(0, 0)"); await sleep(500); };
    if (o.sectionShots || o.prime || (o.steps ?? []).some((x) => x.full)) await prime();
    let outline: Outline | undefined;
    for (const st of o.steps ?? []) {
      if (st.scroll !== undefined) { await ev(`window.scrollTo(0, ${Number(st.scroll)})`); await sleep(700); }
      if (st.hover) { await ev(`(() => { const e = document.querySelector(${JSON.stringify(st.hover)}); if (e) { e.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); } return !!e; })()`); await sleep(300); }
      if (st.click) { const hit = await ev(`(() => { const q = ${JSON.stringify(st.click)}; let e = null; try { e = document.querySelector(q); } catch (x) {} if (!e) e = [...document.querySelectorAll('a,button,[role=button]')].find((x) => ((x.innerText || '') + ' ' + (x.getAttribute('aria-label') || '') + ' ' + (x.getAttribute('title') || '')).toLowerCase().includes(q.toLowerCase())); if (e) { e.click(); return true; } return false; })()`); results.push({ click: st.click, found: hit }); await sleep(900); }
      if (st.wait) await sleep(Math.min(st.wait, 10_000));
      if (st.eval) results.push({ eval: await ev(st.eval) });
      if (st.outline) outline = await ev(OUTLINE_JS) as Outline;
      if (st.shot) {
        if (st.clip) await save(st.shot, { x: 0, y: st.clip.y, width: w, height: Math.min(st.clip.h, 2400) });
        else if (st.section !== undefined || st.selector) { const rect = await ev(st.selector ? `(() => { const e = document.querySelector(${JSON.stringify(st.selector)}); if (!e) return null; const r = e.getBoundingClientRect(); return { x: 0, y: Math.round(r.top + scrollY), width: innerWidth, height: Math.round(r.height) }; })()` : "null"); if (rect) await save(st.shot, { ...rect, height: Math.min(rect.height, 2400) }); }
        else if (st.full) { const dh = Math.min(Number(await ev("document.documentElement.scrollHeight")), 9000); await save(st.shot, { x: 0, y: 0, width: w, height: dh }); }
        else await save(st.shot);
      }
    }
    if (o.sectionShots && !outline) outline = await ev(OUTLINE_JS) as Outline;
    if (o.sectionShots && outline) {   // one full-page shot + one picture per section (what a person scrolls through)
      const tag = o.tag ?? "page"; await ev("window.scrollTo(0, 0)");
      await save(`${tag}-full.png`, { x: 0, y: 0, width: w, height: Math.min(outline.doc_h, 9000) });
      for (const sec of outline.sections.slice(0, o.sectionShots)) await save(`${tag}-section-${String(sec.i + 1).padStart(2, "0")}.png`, { x: 0, y: sec.y, width: w, height: Math.min(sec.h, 2400) });
    }
    return { ok: true, shots, outline, results, console: [...new Set(logs)].slice(0, 6) };
  } catch (e) { return { ok: false, reason: String((e as Error).message).slice(0, 200), shots, results, console: logs }; }
  finally { cdp?.close(); proc?.kill("SIGKILL"); if (dir) rmSync(dir, { recursive: true, force: true }); if (ownTab && ep) { await fetch(ep + "/json/close/" + ownTab).catch(() => 0); for (let i = 0; i < 12; i++) { const gone = await fetch(ep + "/json/list").then((r) => r.json() as Promise<Tab[]>).then((l) => !l.some((t) => t.id === ownTab)).catch(() => true); if (gone) break; await sleep(150); } } }   // the person's browser is left exactly as it was: wait until our tab is really gone
}
export { existsSync };
