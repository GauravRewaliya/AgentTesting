// Runs INSIDE the container. /work = the app folder (read-only mount), /out = the only writable folder.
// Serves /work on 127.0.0.1, opens index.html in headless Chromium with video recording on, types into the first input and clicks the first button (if any), then writes:
//   /out/qa.webm   the video (1280x720)        /out/qa.png  screenshot at the end        /out/qa.json  { title, url, typed, texts, console_errors, page_errors, ok }
import http from "node:http";
import { createReadStream, existsSync, readdirSync, renameSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { chromium } from "playwright-core";

const WORK = "/work", OUT = "/out", MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png" };
const [VW, VH] = (process.env.QA_VIEWPORT ?? "1280x720").split("x").map(Number);   // QA_VIEWPORT="390x844" for a phone app
const typeText = process.env.QA_TYPE ?? "Café Crème 2026!", route = process.env.QA_ROUTE ?? "/";   // QA_ROUTE: which page of the app to open (an Expo Router route such as /3d-rotate)
let server = null, url;
if (process.env.QA_URL) url = process.env.QA_URL.replace(/\/?$/, "/");   // record an already running (dev) server instead of serving /work
else {
  server = http.createServer((req, res) => {
    const p = normalize(decodeURIComponent((req.url ?? "/").split("?")[0])).replace(/^(\.\.[/\\])+/, ""), f = join(WORK, p === "/" ? "index.html" : p);
    let file = f; for (const c of [f, f + ".html", join(f, "index.html"), join(WORK, "index.html")]) { if (c.startsWith(WORK) && existsSync(c) && !statSync(c).isDirectory()) { file = c; break; } }   // static-export routes, then SPA fallback
    if (!file.startsWith(WORK) || !existsSync(file) || statSync(file).isDirectory()) { res.writeHead(404); res.end("not found"); return; }
    res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" }); createReadStream(file).pipe(res);
  }).listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  url = `http://127.0.0.1:${server.address().port}/`;
}
const summary = { url, typed: null, texts: [], console_errors: [], page_errors: [], ok: false };
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, recordVideo: { dir: OUT, size: { width: VW, height: VH } } });
const page = await ctx.newPage();
page.on("console", (m) => { if (m.type() === "error") summary.console_errors.push(m.text().slice(0, 200)); });
page.on("pageerror", (e) => summary.page_errors.push(String(e).slice(0, 200)));
try {
  await page.goto(url + route.replace(/^\//, ""), { waitUntil: "load" }); summary.route = route; summary.title = await page.title();
  // an Expo web bundle renders late (big JS, fonts): wait until the app root has real content, up to 20 s (a plain page is ready at once)
  try { await page.waitForFunction(() => { const r = document.querySelector("#root, #__next, main, body"); return r && (r.id === "root" ? r.children.length > 0 && r.innerText.trim().length + r.querySelectorAll("img,svg,canvas,button,input").length > 0 : document.body.innerText.trim().length > 0 || document.querySelectorAll("input,button,img,canvas").length > 0); }, null, { timeout: Number(process.env.QA_RENDER_TIMEOUT ?? 20000) }); summary.rendered = true; } catch { summary.rendered = false; }
  await page.waitForTimeout(1200);
  const input = page.locator("input, textarea").first();
  if (await input.count()) { await input.click(); await input.pressSequentially(typeText, { delay: 120 }); summary.typed = typeText; await page.waitForTimeout(600); }
  summary.texts = (await page.locator("h1, h2, p, code, output, [id]").allInnerTexts()).map((t) => t.trim()).filter(Boolean).slice(0, 12);   // read BEFORE clicking anything
  await page.screenshot({ path: join(OUT, "qa.png") });
  const button = page.locator("button").first();
  if (await button.count()) { await button.click(); summary.clicked = (await button.innerText()).trim(); await page.waitForTimeout(800); }
  summary.ok = summary.page_errors.length === 0;
} catch (e) { summary.error = String(e).slice(0, 300); }
await ctx.close(); await browser.close(); server?.close();
const vid = readdirSync(OUT).find((f) => f.endsWith(".webm") && f !== "qa.webm"); if (vid) renameSync(join(OUT, vid), join(OUT, "qa.webm"));
summary.video = existsSync(join(OUT, "qa.webm")); writeFileSync(join(OUT, "qa.json"), JSON.stringify(summary, null, 1));
process.exit(summary.ok && summary.video ? 0 : 1);
