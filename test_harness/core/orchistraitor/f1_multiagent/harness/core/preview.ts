// LIVE PREVIEW of an app folder = a background script (core/bg.ts) that runs its dev server on the HOST, in the task workspace, on a free port.
// Same record, log, status and stop as every background script; `public_url` is what a browser on another machine opens (`PREVIEW_PUBLIC_HOST`, else this machine's LAN IP).
//   - folder with package.json: `pnpm install` (CI=true for the install only: no prompts, the server itself keeps watch mode) then the `web` (Expo), `dev` or `start` script on {port}; Vite-style servers get `--host 0.0.0.0`, Expo takes `--port` only
//   - folder with only index.html: static server (core/static_server.ts, no install)
// Settings come from the environment, else from <repo>/.env (see .env.example): PREVIEW_PUBLIC_HOST, PREVIEW_BIND is not needed any more (the script binds itself), PREVIEW_PORT_FROM/TO.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { networkInterfaces } from "node:os";
import { join, resolve } from "node:path";
import { bgLog, freePort, getBg, listBg, startBg, stopBg, waitReady, type BgRow } from "./bg.ts";

const REPO_ENV = join(import.meta.dir, "..", "..", "..", "..", "..", "..", ".env");
const fileEnv = (): Record<string, string> => { try { return Object.fromEntries(readFileSync(REPO_ENV, "utf8").split("\n").map((l) => l.match(/^\s*(PREVIEW_\w+)\s*=\s*(.*?)\s*$/)).filter((m): m is RegExpMatchArray => !!m).map((m) => [m[1]!, m[2]!.replace(/^['"]|['"]$/g, "")])); } catch { return {}; } };
export const cfg = (key: string, dflt = ""): string => process.env[key] || fileEnv()[key] || dflt;

/** The host name a BROWSER should use. `localhost` fails from another machine / through a tunnel: PREVIEW_PUBLIC_HOST, else this machine's first LAN IPv4 (not docker/loopback), else 127.0.0.1. */
export function publicHost(): string {
  if (cfg("PREVIEW_PUBLIC_HOST")) return cfg("PREVIEW_PUBLIC_HOST");
  for (const [name, list] of Object.entries(networkInterfaces())) {
    if (/^(docker|br-|veth|lo)/.test(name)) continue;
    const a = (list ?? []).find((x) => x.family === "IPv4" && !x.internal); if (a) return a.address;
  }
  return "127.0.0.1";
}
// EXPO apps are NOT started from the workspace as they are: the QA step already learned that a browser cannot run native-only packages (react-native-pulsar, keyboard-controller ... crash with
// "getEnforcing of undefined" = a blank page), so it works on a COPY and runs infra/qa/web_only.mjs on it (app.json single-page output, one copy of @react-navigation, native-only packages stubbed ON WEB ONLY).
// The preview does the same: a copy in <store>/preview_copy/<app> (node_modules not copied, pnpm installs it from the shared store), the workspace app is never changed.
const WEB_ONLY = join(import.meta.dir, "..", "..", "..", "..", "..", "infra", "qa", "web_only.mjs");
const NATIVE_ONLY_DEFAULT = "^react-native-pulsar,^react-native-keyboard-controller";   // same list as TestCases/.../demos/enzo_cherry.ts; add more with PREVIEW_NATIVE_ONLY="re1,re2"
const q = (x: string) => JSON.stringify(x);
/** Which command starts the folder (with `{port}` for the free port), or why it cannot be previewed. */
export function detect(dir: string, storeDir = ""): { kind: "dev-server" | "static"; cmd: string } | { error: string } {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return { error: `not a folder: ${dir}` };
  const pj = join(dir, "package.json");
  if (existsSync(pj)) {
    const pk = JSON.parse(readFileSync(pj, "utf8")), scripts = (pk.scripts ?? {}) as Record<string, string>, isExpo = !!{ ...pk.dependencies, ...pk.devDependencies }.expo;
    const s = isExpo && scripts.web ? "web" : scripts.dev ? "dev" : scripts.start ? "start" : "";
    if (!s) return { error: "package.json has no dev, start or web script" };
    if (isExpo && storeDir) {
      const copy = join(storeDir, "preview_copy", dir.split("/").pop()!);
      return { kind: "dev-server", cmd: `mkdir -p ${q(copy)} && tar --exclude=node_modules --exclude=.expo -cf - -C ${q(dir)} . | tar -xf - -C ${q(copy)} && cd ${q(copy)} && QA_NATIVE_ONLY=${q(cfg("PREVIEW_NATIVE_ONLY", NATIVE_ONLY_DEFAULT))} node ${q(WEB_ONLY)} ${q(copy)} && CI=true pnpm install --prefer-offline --no-frozen-lockfile && pnpm run ${s} --port {port}` };
    }
    return { kind: "dev-server", cmd: `CI=true pnpm install --prefer-offline --no-frozen-lockfile && pnpm run ${s} ${isExpo ? "" : "--host 0.0.0.0 "}--port {port}` };
  }
  if (existsSync(join(dir, "index.html"))) return { kind: "static", cmd: `bun ${q(join(import.meta.dir, "static_server.ts"))} {port} .` };   // zero dependencies: nothing is installed
  return { error: "no package.json and no index.html in the folder" };
}
/** "The server answers" is not "the page works": load the page in headless Chrome (host `google-chrome`, if installed) and report a blank page or the JavaScript errors. Takes up to ~`budgetMs` + 20 s. */
export const WEBGPU_FLAGS = "--enable-unsafe-webgpu --enable-features=Vulkan --use-vulkan=swiftshader --use-webgpu-adapter=swiftshader --use-angle=swiftshader --disable-vulkan-surface --ignore-gpu-blocklist --enable-unsafe-swiftshader";
/** Does a PLAIN Chrome on this machine (no special flags) have a WebGPU adapter? Without one, a 3D/WebGPU scene draws nothing and says nothing (only the normal UI shows). */
export function webgpuAdapter(): "yes" | "no" | "unknown" {
  const chrome = ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"].find((c) => spawnSync("which", [c]).status === 0); if (!chrome) return "unknown";
  const dir = mkdtempSync(join(tmpdir(), "pvgpu-"));
  try {
    const html = "<script>(async()=>{try{const a=await navigator.gpu.requestAdapter();document.title='ADAPTER_'+(a?'YES':'NO')}catch(e){document.title='ADAPTER_'+'NO'}})()</script>";
    writeFileSync(join(dir, "gpu.html"), "<!doctype html><title>x</title>" + html);   // file:// is a secure context (data: is not, navigator.gpu would be missing)
    const r = spawnSync(chrome, ["--headless=new", "--no-sandbox", `--user-data-dir=${dir}`, "--virtual-time-budget=8000", "--dump-dom", "file://" + join(dir, "gpu.html")], { encoding: "utf8", timeout: 20_000 });
    return /<title>ADAPTER_YES<\/title>/.test(r.stdout ?? "") ? "yes" : /<title>ADAPTER_NO<\/title>/.test(r.stdout ?? "") ? "no" : "unknown";
  } catch { return "unknown"; } finally { rmSync(dir, { recursive: true, force: true }); }
}
export function checkPage(url: string, budgetMs = 30_000): { checked: boolean; renders?: boolean; errors: string[]; why?: string; webgpu_adapter?: string; note?: string } {
  const chrome = ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"].find((c) => spawnSync("which", [c]).status === 0);
  if (!chrome) return { checked: false, errors: [], why: "no Chrome/Chromium on this machine" };
  const dir = mkdtempSync(join(tmpdir(), "pvcheck-"));
  try {
    const r = spawnSync(chrome, ["--headless=new", "--no-sandbox", "--disable-gpu", `--user-data-dir=${dir}`, "--enable-logging=stderr", "--v=0", `--virtual-time-budget=${budgetMs}`, "--dump-dom", url], { encoding: "utf8", timeout: budgetMs + 20_000, maxBuffer: 32 * 1024 * 1024 });
    const errors = [...new Set([...(r.stderr ?? "").matchAll(/CONSOLE[^"]*"((?:Uncaught|TypeError|ReferenceError|Error)[^"]{0,300})/g)].map((m) => m[1]!))].slice(0, 5);
    const dom = r.stdout ?? "", rootEmpty = /<div id="(root|app|__next)"[^>]*>\s*<\/div>/.test(dom), bodyText = dom.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/g, "").trim();
    if (/main-frame-error|class="neterror"|ERR_CONNECTION_REFUSED|This site can.t be reached/.test(dom)) return { checked: true, renders: false, errors: [], why: "the browser could not reach the page (connection refused or no answer)" };
    const renders = !rootEmpty && (bodyText.length > 0 || /<(canvas|img|svg|video)/.test(dom)) && errors.length === 0;
    const gpu = /<canvas/.test(dom) ? webgpuAdapter() : "unknown", note = gpu === "no" ? `Chrome here has NO WebGPU adapter: a 3D/WebGPU scene (a canvas that stays empty while the normal UI draws) shows nothing and says nothing. Start Chrome with: google-chrome ${WEBGPU_FLAGS} ${url}` : undefined;
    return { checked: true, webgpu_adapter: gpu, note, renders, errors, why: renders ? undefined : errors.length ? "the page threw a JavaScript error" : rootEmpty ? "the page stayed empty (nothing was drawn)" : "no visible content" };
  } catch (e) { return { checked: false, errors: [], why: String((e as Error).message).slice(0, 120) }; }
  finally { rmSync(dir, { recursive: true, force: true }); }
}
/** A prototype made by `proto_init` has proto.json: open EVERY route in headless Chrome (all at once) and report what looks unfinished: a TODO / coming soon stub, lorem ipsum, undefined / NaN / [object Object] in the text,
 *  a table with no rows, a "screen not found", a JavaScript error, or almost no content. One line per bad route, so the lead hands exactly that to the builder that owns the screen. Takes ~10 s for any number of routes. */
export async function smokeRoutes(baseUrl: string, routes: { id: string; label?: string; file?: string }[], budgetMs = 6_000): Promise<{ route: string; problems: string[] }[]> {
  const chrome = ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"].find((c) => spawnSync("which", [c]).status === 0); if (!chrome) return [];
  const one = (r: { id: string; label?: string; file?: string }) => new Promise<{ route: string; problems: string[] }>((done) => {
    const dir = mkdtempSync(join(tmpdir(), "pvsmoke-")); let out = "", err = "";
    const p = spawn(chrome, ["--headless=new", "--no-sandbox", "--disable-gpu", `--user-data-dir=${dir}`, "--enable-logging=stderr", "--v=0", `--virtual-time-budget=${budgetMs}`, "--dump-dom", `${baseUrl}/#/${r.id}`]);
    p.stdout.on("data", (b) => { out += b; }); p.stderr.on("data", (b) => { err += b; });
    const finish = () => {
      rmSync(dir, { recursive: true, force: true });
      const main = (out.match(/<main[^>]*>([\s\S]*?)<\/main>/)?.[1] ?? out), text = main.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/g, " ").replace(/\s+/g, " ").trim(), problems: string[] = [];
      const errors = [...new Set([...err.matchAll(/CONSOLE[^"]*"((?:Uncaught|TypeError|ReferenceError|Error|\[Vue warn\])[^"]{0,200})/g)].map((m) => m[1]!))].slice(0, 2);
      if (errors.length) problems.push("JavaScript error: " + errors.join(" | "));
      if (/TODO|coming soon|not built yet/i.test(text)) problems.push("still a stub (TODO / coming soon)");
      if (/lorem ipsum/i.test(text)) problems.push("lorem ipsum text");
      if (/\bundefined\b|\bNaN\b|\[object Object\]|\{\{/.test(text)) problems.push("shows undefined / NaN / [object Object] / a raw {{ }}");
      if (/Screen not found/.test(text)) problems.push(`no Screens.${r.id} is defined`);
      if (/<table/.test(main) && !/<td/.test(main)) problems.push("a table with no rows");
      if (text.length < 60 && !/TODO|not found/i.test(text)) problems.push("almost empty (" + text.length + " characters)");
      done({ route: `#/${r.id}${r.file ? ` (js/screens/${r.file}.js)` : ""}`, problems });
    };
    const t = setTimeout(() => { p.kill("SIGKILL"); }, budgetMs + 25_000); p.on("close", () => { clearTimeout(t); finish(); });
  });
  return (await Promise.all(routes.map(one))).filter((x) => x.problems.length);
}
type PreviewStartPage = ReturnType<typeof checkPage> & { route_problems?: { route: string; problems: string[] }[] };
export type PreviewStart = { ok: true; id: string; public_url: string; url: string; port: number; ready: boolean; status: string; log: string; expires_at?: number; page?: ReturnType<typeof checkPage> & { route_problems?: { route: string; problems: string[] }[] } } | { ok: false; reason: string };
/** Start the preview as a background script. `allowedRoot`: the folder must be inside it. Waits up to `waitSec` for the page to answer (install can take minutes: the script keeps running, read bg_log). */
export async function startPreview(o: { storeDir: string; task: string; dir: string; allowedRoot: string; by?: string; waitSec?: number; timeoutMin?: number; userRequested?: boolean }): Promise<PreviewStart> {
  const dir = resolve(o.dir), root = resolve(o.allowedRoot);
  if (dir !== root && !dir.startsWith(root + "/")) return { ok: false, reason: `the folder must be inside ${root}` };
  const d = detect(dir, o.storeDir); if ("error" in d) return { ok: false, reason: d.error };
  const again = listBg(o.storeDir).find((r) => r.kind === "preview" && r.dir === dir);   // already running for this folder: reuse
  const port = again?.port ?? await freePort(Number(cfg("PREVIEW_PORT_FROM", "5300")), Number(cfg("PREVIEW_PORT_TO", "5399")));
  const m = again ?? startBg(o.storeDir, { task: o.task, cmd: d.cmd, dir, by: o.by ?? "master", label: `preview ${dir.split("/").pop()}`, kind: "preview", port, publicHost: publicHost(), env: { __VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS: publicHost() }, timeoutMin: o.timeoutMin, userRequested: o.userRequested });
  const w = await waitReady(o.storeDir, m.id, `http://127.0.0.1:${port}`, o.waitSec ?? 90);
  const page: PreviewStartPage | undefined = w.ready && cfg("PREVIEW_PAGE_CHECK", "1") !== "0" ? checkPage(`http://127.0.0.1:${port}`) : undefined;
  if (page?.renders && existsSync(join(dir, "proto.json"))) { try { const pj = JSON.parse(readFileSync(join(dir, "proto.json"), "utf8")); const bad = await smokeRoutes(`http://127.0.0.1:${port}`, pj.routes ?? []); if (bad.length) page.route_problems = bad; } catch { /* a broken proto.json is proto_check's job */ } }
  return { ok: true, id: m.id, page, expires_at: m.expires_at, public_url: `http://${publicHost()}:${port}`, url: `http://127.0.0.1:${port}`, port, ready: w.ready, status: w.status, log: bgLog(o.storeDir, m.id, 15) ?? "" };
}
export { bgLog, getBg, listBg, stopBg, type BgRow };
