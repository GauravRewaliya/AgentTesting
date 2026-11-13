// CONNECTED BROWSER: agents can use a Chrome that a PERSON can see and has logged in to, instead of a private headless one. Chrome exposes the DevTools protocol on a debug port
// (`--remote-debugging-port`); the harness attaches to it, lists its tabs (the "sessions"), opens its own tab to work in (closed afterwards) or attaches to a tab the person already has open.
// State: test_harness/.state/browser.json {endpoint, since} or the env var HARNESS_CDP_URL. No endpoint = the private headless Chrome of core/browse.ts (the default, nothing persists).
// Chrome 136+ ignores the debug port on the DEFAULT profile, so `browser_launch` starts Chrome with its OWN profile folder (test_harness/.state/chrome-profile): log in there once, the sessions stay.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { dirname, join } from "node:path";

const STATE = join(import.meta.dir, "..", "..", "..", "..", "..", ".state"), PROFILE = join(STATE, "chrome-profile");
const file = () => process.env.HARNESS_BROWSER_STATE || join(STATE, "browser.json");   // tests point this at a scratch file so a real saved connection is never read or changed
export const chromeBin = () => ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"].find((c) => spawnSync("which", [c]).status === 0);
export interface Tab { id: string; title: string; url: string; type: string; webSocketDebuggerUrl?: string }
export interface Status { mode: "attached" | "headless"; endpoint?: string; browser?: string; userAgent?: string; tabs?: Tab[]; reachable?: boolean; since?: string; note: string }

const readCfg = (): { endpoint?: string; since?: string; enabled?: boolean } => { try { return JSON.parse(readFileSync(file(), "utf8")); } catch { return {}; } };
/** the browser agents use, or undefined (= the private headless Chrome): a connected endpoint that is switched ON (toggle: agents stop using it without disconnecting) */
export function attachedEndpoint(): string | undefined {
  if (process.env.HARNESS_CDP_URL) return process.env.HARNESS_CDP_URL.replace(/\/$/, "");
  const c = readCfg(); return c.endpoint && c.enabled !== false ? c.endpoint : undefined;
}
export const savedEndpoint = () => readCfg().endpoint;
/** switch the connected browser ON / OFF for agents; the connection (endpoint) is remembered */
export async function toggle(on: boolean): Promise<Status | { ok: false; reason: string }> {
  const c = readCfg(); if (!c.endpoint) return { ok: false, reason: "no browser connected yet: browser_connect or browser_launch first" };
  mkdirSync(dirname(file()), { recursive: true }); writeFileSync(file(), JSON.stringify({ ...c, enabled: on })); return status();
}
const get = async (url: string, init?: RequestInit) => { const r = await fetch(url, { ...init, signal: AbortSignal.timeout(4000) }); if (!r.ok) throw new Error(`${r.status} ${url}`); return r; };
export async function sessions(endpoint: string): Promise<{ browser: string; userAgent: string; tabs: Tab[] }> {
  const v = await (await get(endpoint + "/json/version")).json() as Record<string, string>, t = await (await get(endpoint + "/json/list")).json() as Tab[];
  return { browser: v.Browser ?? "?", userAgent: v["User-Agent"] ?? "", tabs: t.filter((x) => x.type === "page").map(({ id, title, url, type }) => ({ id, title: title.slice(0, 80), url: url.slice(0, 160), type })) };
}
export async function status(): Promise<Status> {
  const ep = attachedEndpoint();
  if (!ep && savedEndpoint()) return { mode: "headless", endpoint: savedEndpoint(), note: `The connected browser at ${savedEndpoint()} is switched OFF: agents use the private headless Chrome. Switch it on with browser_toggle --on (or the toggle in the UI).` };
  if (!ep) return { mode: "headless", note: "No browser connected: pages are opened in a private headless Chrome (nothing is kept, no logins). Connect one: `browser_launch` (a visible Chrome with its own profile, log in once) or `browser_connect --url http://127.0.0.1:9222` (a Chrome you started with --remote-debugging-port=9222)." };
  try { const s = await sessions(ep); let since: string | undefined; try { since = (JSON.parse(readFileSync(file(), "utf8")) as { since?: string }).since; } catch { /* env only */ } return { mode: "attached", endpoint: ep, reachable: true, since, ...s, note: `Agents use THIS browser (new tab per task, closed afterwards). ${s.tabs.length} open tab(s). To inspect a tab you already have open: browse --tab "<part of its url or title>".` }; }
  catch (e) { return { mode: "attached", endpoint: ep, reachable: false, note: `The connected browser at ${ep} does not answer (${String((e as Error).message).slice(0, 80)}). Start it again with browser_launch or disconnect with browser_disconnect; until then agents fall back to the private headless Chrome.` }; }
}
export async function connect(endpoint: string): Promise<Status | { ok: false; reason: string }> {
  const ep = endpoint.replace(/\/$/, ""); if (!/^https?:\/\/[\w.-]+:\d+$/.test(ep)) return { ok: false, reason: "give --url http://127.0.0.1:9222 (host and port of the Chrome debug port)" };
  try { await sessions(ep); } catch (e) { return { ok: false, reason: `nothing answers at ${ep} (${String((e as Error).message).slice(0, 60)}). Start Chrome with: google-chrome --remote-debugging-port=${ep.split(":").pop()} --user-data-dir=<a folder>, or run browser_launch.` }; }
  mkdirSync(dirname(file()), { recursive: true }); writeFileSync(file(), JSON.stringify({ endpoint: ep, since: new Date().toISOString(), enabled: true })); return status();
}
export function disconnect() { rmSync(file(), { force: true }); return { ok: true, note: "Disconnected: agents use the private headless Chrome again. (The browser itself keeps running.)" }; }
/** Start a VISIBLE Chrome with a debug port and its own profile (so logins persist and the person can watch / log in), then connect to it. */
export async function launch(port = 9222, url = "about:blank"): Promise<Status | { ok: false; reason: string }> {
  const ep = `http://127.0.0.1:${port}`;
  try { await sessions(ep); return connect(ep); } catch { /* not running yet */ }
  const bin = chromeBin(); if (!bin) return { ok: false, reason: "no Chrome / Chromium on this machine" };
  if (!process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) return { ok: false, reason: "this machine has no display (DISPLAY is empty): a visible Chrome cannot open here. Start Chrome on YOUR desktop: google-chrome --remote-debugging-port=" + port + " --remote-debugging-address=127.0.0.1 --user-data-dir=<folder>, then reach it with an SSH tunnel (ssh -L " + port + ":127.0.0.1:" + port + " <this-machine>) and run browser_connect --url " + ep };
  mkdirSync(PROFILE, { recursive: true });
  spawn(bin, [`--remote-debugging-port=${port}`, "--remote-debugging-address=127.0.0.1", `--user-data-dir=${PROFILE}`, "--no-first-run", "--no-default-browser-check", url], { detached: true, stdio: "ignore" }).unref();
  for (let i = 0; i < 40; i++) { await new Promise((r) => setTimeout(r, 250)); try { await sessions(ep); return connect(ep); } catch { /* starting */ } }
  return { ok: false, reason: `Chrome started but its debug port ${port} did not answer in 10 s` };
}
export const profileDir = () => (existsSync(PROFILE) ? PROFILE : undefined);
/** Open a URL in a NEW tab of the connected browser (a person sees it open). */
export async function openTab(url: string): Promise<Tab | { ok: false; reason: string }> {
  const ep = attachedEndpoint(); if (!ep) return { ok: false, reason: "no browser connected" };
  if (!/^(https?|file):\/\//.test(url)) return { ok: false, reason: "url must start with http://, https:// or file://" };
  try { return await (await get(ep + "/json/new?" + encodeURIComponent(url), { method: "PUT" })).json() as Tab; } catch (e) { return { ok: false, reason: String((e as Error).message).slice(0, 100) }; }
}
