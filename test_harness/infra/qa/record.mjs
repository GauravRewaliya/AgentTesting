// Runs INSIDE the container. /work = the app folder (read-only mount, static mode) or QA_URL = an already running dev server. /out = the only writable folder.
// RULE: CHECK FIRST, SHOOT ONLY A HEALTHY PAGE. A run that is broken, blank, shows an error overlay, or says it cannot run here (fail_on_text, e.g. "needs Skia Graphite") keeps ONLY the image qa.png + qa.json + REPORT.txt:
//       a video of a broken page is useless and is never made. A demo that cannot run on web AT ALL is declared in its case (`qa: () => ({ enabled: false, why })`, flagged "no video"): then no container is started either.
// Two phases, in this order (a broken app must NOT cost a video):
//   1. SMOKE (no video): open the page once and stop at the FIRST problem: a page error, a framework error overlay (Expo / Vite / Next / "Uncaught Error"), a blank page, or the render timeout.
//      Writes qa.png (the evidence) and qa.json { ok, stage, reasons[], page_errors, console_errors, overlay, texts }.
//   2. RECORD (only if the smoke check passed and QA_MODE is not "check"): the same page with video, types into the first input, clicks the first button -> qa.webm.
// QA_MODE=check  = phase 1 only (what `tools.ts qa_check` and the master use while developing).     exit code 0 = healthy (and, in record mode, a video exists), 1 = not.
import http from "node:http";
import { createReadStream, existsSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { chromium } from "playwright-core";

const WORK = "/work", OUT = "/out", MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png" };
const [VW, VH] = (process.env.QA_VIEWPORT ?? "1280x720").split("x").map(Number), MODE = process.env.QA_MODE ?? "record", RENDER = Number(process.env.QA_RENDER_TIMEOUT ?? 30000);
const typeText = process.env.QA_TYPE ?? "Café Crème 2026!", route = process.env.QA_ROUTE ?? "/";
let server = null, url;
if (process.env.QA_URL) url = process.env.QA_URL.replace(/\/?$/, "/");
else {
  server = http.createServer((req, res) => {
    const p = normalize(decodeURIComponent((req.url ?? "/").split("?")[0])).replace(/^(\.\.[/\\])+/, ""), f = join(WORK, p === "/" ? "index.html" : p);
    let file = f; for (const c of [f, f + ".html", join(f, "index.html"), join(WORK, "index.html")]) { if (c.startsWith(WORK) && existsSync(c) && !statSync(c).isDirectory()) { file = c; break; } }
    if (!file.startsWith(WORK) || !existsSync(file) || statSync(file).isDirectory()) { res.writeHead(404); res.end("not found"); return; }
    res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" }); createReadStream(file).pipe(res);
  }).listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  url = `http://127.0.0.1:${server.address().port}/`;
}
const target = url + route.replace(/^\//, "");
const summary = { url, mode: MODE, stage: "smoke", ok: false, reasons: [], typed: null, texts: [], console_errors: [], page_errors: [], overlay: null };
const NOISE = /WebSocket connection|favicon|ERR_ABORTED|Download the React DevTools|\[HMR\]|\/hot\b|\/message\b/i;   // dev-server chatter, not an app problem
const OVERLAY = /Uncaught Error|Unhandled Runtime Error|Application error|Something went wrong|Failed to compile|Internal Server Error|Cannot access .* before initialization|is not defined|is not a function|Module not found|Unable to resolve/i;

/** What the page looks like right now: error overlay text, visible text, and how many real elements it shows. */
const probe = () => {
  const body = document.body, t = (body.innerText || "").trim();
  const custom = document.querySelector("vite-error-overlay, nextjs-portal, #webpack-dev-server-client-overlay, [data-testid='redbox'], [id*='error-overlay' i]");
  const m = t.match(/(Uncaught Error|Unhandled Runtime Error|Application error|Something went wrong|Failed to compile|Internal Server Error|Cannot access [^\n]* before initialization|Module not found|Unable to resolve)[^\n]*/i);
  const shown = [...document.querySelectorAll("img,svg,canvas,button,input,textarea,a,h1,h2,h3,p,li")].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2; }).length;
  return { text: t.length, shown, overlay: custom ? (custom.shadowRoot?.textContent ?? custom.textContent ?? "overlay").trim().slice(0, 300) : m ? m[0].slice(0, 300) : null };
};

// the dev server's own log (QA_DEVLOG, default /tmp/dev.log): a build/resolve error shows up here seconds before the page gives up
const DEVLOG = process.env.QA_DEVLOG ?? "/tmp/dev.log";
const devLogError = () => { try { const m = readFileSync(DEVLOG, "utf8").match(/^.*(Unable to resolve|Failed to resolve import|Module not found|Cannot find module|SyntaxError|Failed to compile|Transform failed|error during build)[^\n]*/im); return m ? m[0].trim().slice(0, 260) : null; } catch { return null; } };
const browser = await chromium.launch({ args: ["--no-sandbox", ...(process.env.QA_BROWSER_ARGS ? process.env.QA_BROWSER_ARGS.split(" ").filter(Boolean) : [])] });   // QA_BROWSER_ARGS: extra Chromium flags of the case (e.g. software WebGPU)
// ---------------- phase 1: SMOKE (no video, stops at the first problem) ----------------
{
  const ctx = await browser.newContext({ viewport: { width: VW, height: VH } }), page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error" && !NOISE.test(m.text())) summary.console_errors.push(m.text().slice(0, 200)); });
  page.on("pageerror", (e) => summary.page_errors.push(String(e).slice(0, 240)));
  const t0 = Date.now(); let state = { text: 0, shown: 0, overlay: null };
  try {
    page.goto(target, { waitUntil: "commit", timeout: RENDER }).catch((e) => { if (!summary.page_errors.length) summary.reasons.push(`page did not load: ${String(e).slice(0, 120)}`); });
    for (let stable = 0; Date.now() - t0 < RENDER;) {   // poll every 400 ms; the FIRST problem ends it
      await page.waitForTimeout(400);
      try { state = await page.evaluate(probe); } catch { continue; }   // the page may be navigating
      if (summary.page_errors.length || state.overlay) break;
      { const bad = devLogError(); if (bad) { summary.reasons.push(`dev server log: ${bad}`); break; } }   // the bundler already said it is broken: no need to wait for the page
      if (state.shown > 0 || state.text > 0) { if (++stable >= 3) break; } else stable = 0;   // content visible for ~1.2 s = rendered
    }
  } catch (e) { summary.reasons.push(String(e).slice(0, 160)); }
  summary.overlay = state.overlay;
  if (summary.page_errors.length) summary.reasons.push(`page error: ${summary.page_errors[0]}`);
  if (state.overlay) summary.reasons.push(`the app shows an error screen: ${state.overlay}`);
  if (!summary.page_errors.length && !state.overlay && state.shown === 0 && state.text === 0) summary.reasons.push(`blank page: nothing visible after ${Math.round((Date.now() - t0) / 1000)} s`);
  // QA_FAIL_ON_TEXT (JSON list of regexes, from the case's qa spec `fail_on_text`): a page that RENDERS but says it cannot run here ("needs Skia Graphite", "not supported on web") is a FAILED run, not a video
  if (process.env.QA_FAIL_ON_TEXT && !summary.reasons.length) {
    try { await page.waitForTimeout(2500); const body = await page.evaluate(() => document.body.innerText || ""); for (const re of JSON.parse(process.env.QA_FAIL_ON_TEXT)) { const m = body.match(new RegExp(re, "i")); if (m) { summary.reasons.push(`the page says it cannot run here: "${m[0].slice(0, 120)}"`); break; } } } catch { /* page gone */ }
  }
  summary.rendered = summary.reasons.length === 0; summary.seconds_to_verdict = Math.round((Date.now() - t0) / 1000);
  try { summary.title = await page.title(); summary.texts = (await page.locator("h1, h2, p, code, output, [id]").allInnerTexts()).map((t) => t.trim()).filter((t) => t && !OVERLAY.test(t)).slice(0, 12); } catch { /* page gone */ }
  await page.screenshot({ path: join(OUT, "qa.png") }).catch(() => {});
  await ctx.close();
}
summary.ok = summary.reasons.length === 0;
if (!summary.ok || MODE === "check") { await browser.close(); server?.close(); summary.video = false; writeFileSync(join(OUT, "qa.json"), JSON.stringify(summary, null, 1)); process.exit(summary.ok ? 0 : 1); }

// ---------------- phase 2: RECORD (the page is healthy: this is cheap now, the bundle is built) ----------------
summary.stage = "record";
{
  const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, recordVideo: { dir: OUT, size: { width: VW, height: VH } } }), page = await ctx.newPage();
  page.on("pageerror", (e) => summary.page_errors.push(String(e).slice(0, 240)));
  try {
    await page.goto(target, { waitUntil: "load", timeout: RENDER });
    await page.waitForFunction(() => { const b = document.body; return (b.innerText || "").trim().length > 0 || document.querySelectorAll("img,svg,canvas,button,input").length > 0; }, null, { timeout: RENDER }).catch(() => {});
    await page.waitForTimeout(1200);
    // QA_STEPS (JSON, set by the case's qa spec `steps`): the case's OWN interaction instead of "type into the first input, click the first button". Steps: {click:"<playwright selector>"} {fill:["sel","text"]} {wait:ms}
    //   {drag:{sel:"<selector>",from:[0.2,0.5],to:[0.8,0.5]}} (mouse drag inside the element, fractions of its box) {shot:"name"} (png in /out) {text:"sel"} (read the text into summary.steps)
    const STEPS = process.env.QA_STEPS ? JSON.parse(process.env.QA_STEPS) : null; summary.steps = [];
    if (STEPS) {
      for (const st of STEPS) {
        try {
          if (st.click) await page.locator(st.click).first().click({ timeout: 15000 });
          else if (st.fill) await page.locator(st.fill[0]).first().fill(st.fill[1]);
          else if (st.wait) await page.waitForTimeout(st.wait);
          else if (st.drag) { const b = await page.locator(st.drag.sel).first().boundingBox(); if (!b) throw new Error("no box for " + st.drag.sel); const at = (f) => [b.x + b.width * f[0], b.y + b.height * f[1]];
            const [x0, y0] = at(st.drag.from), [x1, y1] = at(st.drag.to); await page.mouse.move(x0, y0); await page.mouse.down(); await page.mouse.move((x0 + x1) / 2, (y0 + y1) / 2 - 20, { steps: 12 }); await page.mouse.move(x1, y1, { steps: 12 }); await page.mouse.up(); }
          else if (st.shot) await page.screenshot({ path: join(OUT, st.shot.replace(/[^\w.-]/g, "_") + ".png") });
          else if (st.eval) summary.steps.push({ eval: st.eval.slice(0, 80), value: JSON.stringify(await page.evaluate(st.eval)).slice(0, 300) });
          else if (st.text) summary.steps.push({ text: st.text, value: (await page.locator(st.text).first().innerText()).trim().slice(0, 200) });
          summary.steps.push({ ok: true, step: JSON.stringify(st).slice(0, 120) });
        } catch (e) { summary.steps.push({ ok: false, step: JSON.stringify(st).slice(0, 120), error: String(e).slice(0, 160) }); summary.reasons.push("step failed: " + JSON.stringify(st).slice(0, 100) + ": " + String(e).slice(0, 120)); break; }
      }
    }
    const input = STEPS ? { count: async () => 0 } : page.locator("input, textarea").first();
    if (await input.count()) { try { await input.click({ timeout: 4000 }); await input.pressSequentially(typeText, { delay: 120 }); summary.typed = typeText; await page.waitForTimeout(600); } catch (e) { summary.default_flow_skipped = "first input not usable: " + String(e).split("\n")[0].slice(0, 90); } }   // the DEFAULT flow is best effort (an overlay or a hidden input must not fail a healthy page); the QA agent's own steps stay strict
    summary.texts = (await page.locator("h1, h2, p, code, output, [id]").allInnerTexts()).map((t) => t.trim()).filter(Boolean).slice(0, 12);   // read BEFORE clicking anything
    await page.screenshot({ path: join(OUT, "qa.png") });
    const button = STEPS ? { count: async () => 0 } : page.locator("button").first();
    if (await button.count()) { try { await button.click({ timeout: 4000 }); summary.clicked = (await button.innerText()).trim(); await page.waitForTimeout(800); } catch (e) { summary.default_flow_skipped = "first button not clickable: " + String(e).split("\n")[0].slice(0, 90); } }
  } catch (e) { summary.reasons.push(String(e).slice(0, 200)); }
  await ctx.close();
}
await browser.close(); server?.close();
const vid = readdirSync(OUT).find((f) => f.endsWith(".webm") && f !== "qa.webm"); if (vid) renameSync(join(OUT, vid), join(OUT, "qa.webm"));
summary.video = existsSync(join(OUT, "qa.webm")); summary.ok = summary.reasons.length === 0 && summary.page_errors.length === 0 && summary.video;
writeFileSync(join(OUT, "qa.json"), JSON.stringify(summary, null, 1));
process.exit(summary.ok ? 0 : 1);
