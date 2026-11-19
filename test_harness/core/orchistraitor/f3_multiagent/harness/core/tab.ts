// ONE BROWSER PROFILE PER USER, ONE TAB PER AGENT (like Claude's own browser): the user's Chrome profile (test_harness/.state/chrome-profile, the same one `browser_launch` uses, so logins carry over) is opened ONCE in a
// private headless Chrome that stays up between commands, and every agent gets its OWN TAB in it. `browser tab open` makes the tab, every `browser tab do` runs a whole script of steps on THAT tab (no reopening, no reloading),
// `browser tab close` closes the tab (the last tab closed also ends the headless Chrome). If the person's connected (visible) Chrome is switched on, its tab is used instead. No files in the session's store: the little
// registry (which agent has which tab) is .state/headless.json.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { STATE_BASE } from "@core/paths.ts";
import { CHROME_PREFIX, SOFT_GL } from "./chrome_flags.ts";
import { SCREEN, browse, chromeBin, type Step } from "./browse.ts";
import { attachedEndpoint } from "./browser_conn.ts";
import { freePort } from "./bg.ts";

interface Reg { port: number; pid: number; started: number; tabs: Record<string, string>; /** folders already cleared in this tab session: --clear works once per folder, so a later script cannot wipe the video the earlier ones made */ cleared?: Record<string, string[]>; /** tabs opened with --video: every `browser tab do` on them records (no need to repeat the flag, and a forgotten flag no longer means no video) */ video?: Record<string, boolean>; /** the clip that is recording now on a tab (named; carries over to the next script until `rec stop`) */ rec?: Record<string, string> }
const REG = join(STATE_BASE, "headless.json"), PROFILE = join(STATE_BASE, "chrome-profile");
/** one agent may hold several tabs: `--tab admin` is a second one (the first is "main") */
const keyOf = (task: string, agent: string, tab?: string) => `${task}/${agent}${tab && tab !== "main" ? "#" + tab : ""}`;
const read = (): Reg | undefined => { try { return JSON.parse(readFileSync(REG, "utf8")); } catch { return undefined; } };
const write = (r: Reg) => { mkdirSync(STATE_BASE, { recursive: true }); writeFileSync(REG, JSON.stringify(r)); };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const up = async (ep: string) => { try { await fetch(`${ep}/json/version`, { signal: AbortSignal.timeout(1500) }); return true; } catch { return false; } };
const tabsOf = async (ep: string) => (await (await fetch(`${ep}/json/list`)).json()) as { id: string; type: string; url: string; title: string }[];

/** the Chrome agents use: the person's connected one when it is on and answers, else the shared headless one (started here when it is not up) */
async function endpoint(): Promise<{ ep: string; own: boolean } | { error: string }> {
  const att = attachedEndpoint(); if (att && await up(att)) return { ep: att, own: false };
  let r = read(); if (r && await up(`http://127.0.0.1:${r.port}`)) return { ep: `http://127.0.0.1:${r.port}`, own: true };
  const bin = chromeBin(); if (!bin) return { error: "Chrome is not installed on this machine" };
  mkdirSync(PROFILE, { recursive: true });
  const port = await freePort(9300, 9399);
  const child = spawn(CHROME_PREFIX[0]!, [...CHROME_PREFIX.slice(1), "timeout", "14400", bin, "--headless=new", "--no-sandbox", ...SOFT_GL, "--hide-scrollbars", "--allow-file-access-from-files", "--no-first-run", `--remote-debugging-port=${port}`, `--user-data-dir=${PROFILE}`, `--window-size=${SCREEN.w},${SCREEN.h + 120}`, "about:blank"], { stdio: "ignore", detached: true });
  child.unref();
  for (let i = 0; i < 60; i++) { await sleep(150); if (await up(`http://127.0.0.1:${port}`)) { write({ port, pid: child.pid!, started: Date.now(), tabs: {} }); return { ep: `http://127.0.0.1:${port}`, own: true }; } }
  return { error: "Chrome did not start (is the visible Chrome using the same profile? switch it off with browser_toggle --off or close it)" };
}

/** a `browser tab do --video` was run on this tab: the tab session owes a video (tab close checks it) */
export function setRec(task: string, agent: string, clip: string, tab?: string) { const r = read(); if (!r) return; const k = keyOf(task, agent, tab); if (clip) { (r.video ??= {})[k] = true; (r.rec ??= {})[k] = clip; } else if (r.rec) delete r.rec[k]; write(r); }
export const recOf = (task: string, agent: string, tab?: string) => read()?.rec?.[keyOf(task, agent, tab)] ?? "";
export async function tabOpen(o: { task: string; agent: string; url?: string; mobile?: boolean; video?: boolean; tab?: string }): Promise<Record<string, unknown>> {
  const k = keyOf(o.task, o.agent, o.tab), e = await endpoint(); if ("error" in e) return { ok: false, reason: e.error };
  const reg = read() ?? { port: Number(e.ep.split(":").pop()), pid: 0, started: Date.now(), tabs: {} };
  const have = reg.tabs[k]; if (have && (await tabsOf(e.ep)).some((t) => t.id === have)) { if (o.video) { (reg.video ??= {})[k] = true; (reg.rec ??= {})[k] ??= "session"; write(reg); } return { ok: true, reused: true, tab: have, note: "your tab is already open: use `browser tab do` (a {\"goto\":\"<url>\"} step goes elsewhere in it)", video: o.video ? "recording ON for this tab" : undefined }; }
  const t = await (await fetch(`${e.ep}/json/new?${encodeURIComponent(o.url ?? "about:blank")}`, { method: "PUT" })).json() as { id: string };
  reg.tabs[k] = t.id; if (o.video) { (reg.video ??= {})[k] = true; (reg.rec ??= {})[k] = "session"; } write(reg);
  return { ok: true, tab: t.id, url: o.url ?? "about:blank", browser: e.own ? "private headless Chrome (your profile)" : "your connected Chrome (visible)", video: o.video ? "recording ON: every tab do on this tab is recorded into your one session video" : "no video: add --video to `browser tab do` (or to `browser tab open`) to record", next: "tab do --steps '[{\"name\":\"first look\"}]' [--video]" };
}

/** `--clear` is honoured ONCE per folder per tab session (true the first time); later ones are ignored so the one video of the run is never wiped by accident */
export function clearOnce(o: { task: string; agent: string; dir: string }): boolean {
  const r = read(), k = keyOf(o.task, o.agent); if (!r) return true;
  r.cleared ??= {}; const l = (r.cleared[k] ??= []); if (l.includes(o.dir)) return false; l.push(o.dir); write(r); return true;
}

/** run a script of steps on this agent's tab (no navigation, no reload, nothing re-opened) */
export async function tabDo(o: { task: string; agent: string; tab?: string; rec?: string; steps: Step[]; outDir: string; video?: boolean; tag?: string; keepGoing?: boolean; images?: boolean }) {
  const r = read(), id = r?.tabs[keyOf(o.task, o.agent, o.tab)]; const att = attachedEndpoint(); const ep = att && await up(att) && !r?.tabs[keyOf(o.task, o.agent, o.tab)] ? att : r ? `http://127.0.0.1:${r.port}` : att;
  if (!id || !ep || !(await up(ep)) || !(await tabsOf(ep)).some((t) => t.id === id)) return null;
  const steps = o.steps.some((x) => x.snapshot) ? o.steps : [...o.steps, { snapshot: true } as Step];   // every script ends with a look at the page as it is now: the next script is written from it
  return browse({ endpoint: ep, tab: id, steps, outDir: o.outDir, video: o.video, rec: o.rec, tag: o.tag ?? "tab", url: "", keepGoing: o.keepGoing, images: o.images });
}

export async function tabStatus(o: { task: string; agent: string; tab?: string }): Promise<Record<string, unknown>> {
  const r = read(), id = r?.tabs[keyOf(o.task, o.agent, o.tab)], ep = r ? `http://127.0.0.1:${r.port}` : undefined;
  if (!id || !ep || !(await up(ep))) return { ok: true, open: false, note: "no tab is open for you: `browser tab open --url <address>`" };
  const t = (await tabsOf(ep)).find((x) => x.id === id);
  return t ? { ok: true, open: true, url: t.url, title: t.title, tab: id, other_tabs: Object.keys(r!.tabs).filter((k) => k.startsWith(o.task + "/")).length - 1 } : { ok: true, open: false, note: "your tab was closed" };
}

/** close this agent's tab; the last tab closed also ends the headless Chrome */
export async function tabClose(o: { task: string; agent: string; tab?: string }): Promise<Record<string, unknown>> {
  const r = read(), k = keyOf(o.task, o.agent, o.tab), id = r?.tabs[k]; if (!r || !id) return { ok: true, note: "no tab was open" };
  const video_asked = !!r.video?.[k];
  const ep = `http://127.0.0.1:${r.port}`; if (await up(ep)) await fetch(`${ep}/json/close/${id}`).catch(() => 0);
  delete r.tabs[k]; if (r.cleared) delete r.cleared[k]; if (r.video) delete r.video[k]; if (r.rec) delete r.rec[k];
  if (!Object.keys(r.tabs).length && r.pid) { try { process.kill(-r.pid, "SIGKILL"); } catch { try { process.kill(r.pid, "SIGKILL"); } catch { /* gone */ } } rmSync(REG, { force: true }); }
  else write(r);
  return { ok: true, closed: true, video_asked };
}
export { existsSync };
