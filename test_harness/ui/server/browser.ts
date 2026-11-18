// The CONNECTED BROWSER for the dashboard: status, connect / launch / disconnect, the open tabs ("sessions"), a snapshot of a tab, and a "try it" run that opens a page the way an agent does (a real browser,
// outline of its sections + a picture). All the logic is the harness's (core/browser_conn.ts, core/browse.ts); this file only shapes it for the UI.
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { browserConn as bc, browse } from "@core/orchestrator.ts";

const png = (f: string) => { try { return "data:image/png;base64," + readFileSync(f).toString("base64"); } catch { return null; } };
export async function overview() {
  const st = await bc.status();
  return { ...st, saved: bc.savedEndpoint() ?? null, chrome: !!bc.chromeBin(), display: !!(process.env.DISPLAY || process.env.WAYLAND_DISPLAY), profile: bc.profileDir() ?? null, defaultPort: 9222,
    howto: ["Press “Launch Chrome”: a real, visible Chrome with its own profile opens so YOU can log in (the logins stay). Agents keep using the invisible headless Chrome (same pictures) until you switch “agents use it” ON; do that only when a page needs your login.",
      "Your own Chrome: start it with  google-chrome --remote-debugging-port=9222 --remote-debugging-address=127.0.0.1 --user-data-dir=<a folder>  then press Connect (Chrome 136+ ignores the debug port on the default profile).",
      "Chrome on another machine: ssh -L 9222:127.0.0.1:9222 <that-machine>, then Connect to http://127.0.0.1:9222.",
      "Agents: browser_status, browse, ref_capture, ref_compare use the connected browser; `browse --tab \"<part of a url or title>\"` inspects a tab that is already open."] };
}
export const connect = (url: string) => bc.connect(url);
export const launch = (port?: number) => bc.launch(port ?? 9222);
export const disconnect = () => bc.disconnect();
export const toggle = (on: boolean) => bc.toggle(on);
export const open = (url: string) => bc.openTab(url);
/** a picture of one open tab (read only: nothing in the tab changes) */
export async function snapshot(tab: string) {
  const dir = join(tmpdir(), "ui-snap-" + Math.random().toString(36).slice(2, 8)); mkdirSync(dir, { recursive: true });
  try { const r = await browse({ url: "", tab, outDir: dir, steps: [{ eval: "document.title + ' | ' + location.href" }, { shot: "s.png" }] }); return { ok: r.ok, reason: r.reason, title: (r.results[0] as { eval?: string } | undefined)?.eval ?? "", image: png(join(dir, "s.png")) }; }
  finally { rmSync(dir, { recursive: true, force: true }); }
}
/** what an agent sees when it opens a url: full-page picture + the outline of every section (uses the connected browser when there is one) */
export async function tryIt(url: string, scheme: "light" | "dark" = "light") {
  if (!/^https?:\/\//.test(url)) return { ok: false, reason: "give a url starting with http:// or https://" };
  const dir = join(tmpdir(), "ui-try-" + Math.random().toString(36).slice(2, 8)); mkdirSync(dir, { recursive: true });
  try { const t0 = Date.now(), r = await browse({ url, outDir: dir, scheme, sectionShots: 0, steps: [{ shot: "full.png", full: true }, { outline: true }] }); return { ok: r.ok, reason: r.reason, ms: Date.now() - t0, via: (await bc.status()).mode, image: png(join(dir, "full.png")), title: r.outline?.title, theme: r.outline?.theme, sections: r.outline?.sections.map((x) => ({ i: x.i + 1, tag: x.tag, heading: x.heading, cards: x.cards, buttons: x.buttons.length, images: x.images, animated: x.animated })), console: r.console }; }
  finally { rmSync(dir, { recursive: true, force: true }); }
}
