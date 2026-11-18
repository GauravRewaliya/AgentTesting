// BACKGROUND TASKS: like `cmd &` in a shell, but with a record, so nothing is lost. The harness knows NOTHING about what runs: not a preview, not an app, not a project type. The agent decides the
// command, the folder and whether it needs a port; the record is only a description, a status and a log file.
//   <store dir>/bg/<id>.json   description (label), command, folder, who, when, pid, port, public_url
//   <store dir>/bg/<id>.log    stdout + stderr of the command (read it with `bg_log`, or tail the file)
//   <store dir>/bg/<id>.exit   written by the wrapper when the command ENDS ON ITS OWN: its exit code
// Status is derived on every read from those files (no daemon, it survives a restart of the harness/UI):
//   running      the process is alive          succeeded   .exit = 0          failed   .exit != 0
//   stopped      somebody stopped it on purpose (meta.stopped_at/by), or the --timeout the agent asked for ended it (there is NO default limit)
//   interrupted  the process is gone and left no exit code and nobody stopped it (killed, host stopped, reboot ...)
//   (REAPING)    every process of a task carries the env BG_ID=<id>; when a task is not running any more but something of it still lives (a server that outlived its wrapper), the survivors are ended.
// No review clock, no auto-stop, no ownership rules: a task ends when it finishes, when an agent or the person stops it, or when the session is stopped.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, openSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { createServer } from "node:net";
import { join, resolve } from "node:path";

export type BgStatus = "running" | "succeeded" | "failed" | "stopped" | "interrupted";
export interface BgMeta { id: string; task: string; cmd: string; dir: string; pid: number; started: number; by: string; /** a short KIND shown in the UI next to the description: `server_run` (default), `preview`, `wireframe`, `backend` ... */ title?: string; label: string; port?: number; public_url?: string; timeout_s?: number; stopped_at?: number; stopped_by?: string; reaped_at?: number; reaped?: number; /** legacy rows only */ kind?: string; expires_at?: number; user_requested?: boolean; reviewed_at?: number }
export interface BgRow extends BgMeta { status: BgStatus; exit_code?: number; ended_at?: number; log_bytes: number }

const bgDir = (storeDir: string) => join(storeDir, "bg");
const f = (storeDir: string, id: string, ext: string) => join(bgDir(storeDir), `${id.replace(/[^\w-]/g, "")}.${ext}`);
const alive = (pid: number) => { try { process.kill(pid, 0); return true; } catch { return false; } };
export const freePort = (from: number, to: number): Promise<number> => new Promise((ok, no) => {
  const tryPort = (p: number) => { if (p > to) return no(new Error(`no free port in ${from}-${to}`)); const s = createServer(); s.once("error", () => tryPort(p + 1)); s.listen(p, "0.0.0.0", () => s.close(() => ok(p))); };
  tryPort(from);
});

/** Start a command in the background. `{port}` in the command is replaced by `port`; the env also has PORT. `timeoutMin` is optional: without it the command runs until it ends or is stopped. Returns at once. */
export function startBg(storeDir: string, o: { task: string; cmd: string; dir: string; by?: string; title?: string; label?: string; port?: number; publicHost?: string; env?: Record<string, string>; timeoutMin?: number }): BgMeta {
  const dir = resolve(o.dir); if (!existsSync(dir)) throw new Error(`not a folder: ${dir}`);
  mkdirSync(bgDir(storeDir), { recursive: true });
  const id = "b" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), cmd = o.cmd.replaceAll("{port}", String(o.port ?? ""));
  const fd = openSync(f(storeDir, id, "log"), "a"), tmo = o.timeoutMin && o.timeoutMin > 0 ? Math.round(o.timeoutMin * 60) : 0;
  // the wrapper records the exit code of the command when it ends by itself; killed = no .exit file
  const p = spawn("sh", ["-c", 'if [ "$BG_TIMEOUT" -gt 0 ]; then timeout -k 5 "$BG_TIMEOUT" sh -c "$BG_CMD"; else sh -c "$BG_CMD"; fi; c=$?; echo $c > "$BG_EXIT"; exit $c'], { cwd: dir, detached: true, stdio: ["ignore", fd, fd],
    env: { ...process.env, ...(o.env ?? {}), BG_ID: id, BG_CMD: cmd, BG_TIMEOUT: String(tmo), BG_EXIT: f(storeDir, id, "exit"), ...(o.port ? { PORT: String(o.port) } : {}) } });
  p.unref();
  const meta: BgMeta = { id, task: o.task, cmd, dir, pid: p.pid ?? 0, started: Date.now(), by: o.by ?? "agent", title: o.title?.trim() || "server_run", label: o.label ?? cmd.slice(0, 60), port: o.port, timeout_s: tmo || undefined, public_url: o.port && o.publicHost ? `http://${o.publicHost}:${o.port}` : undefined };
  writeFileSync(f(storeDir, id, "json"), JSON.stringify(meta, null, 1));
  return meta;
}
/** The log file of a task (the agent may `tail -f` or Read it). */
export const bgLogFile = (storeDir: string, id: string) => f(storeDir, id, "log");
/** Every live process that carries this script's BG_ID (children inherit it, so a server that outlived its wrapper is found too). */
const survivors = (id: string): number[] => {
  const needle = `BG_ID=${id}\0`, out: number[] = [];
  let pids: string[] = []; try { pids = readdirSync("/proc").filter((n) => /^\d+$/.test(n)); } catch { return []; }
  for (const p of pids) { if (Number(p) === process.pid) continue; try { if (readFileSync(`/proc/${p}/environ`, "latin1").includes(needle)) out.push(Number(p)); } catch { /* not ours / gone */ } }
  return out;
};
/** End what is left of a script that is not running any more; remember it in the record (reaped_at, reaped = how many) so it is done once. */
function reap(storeDir: string, m: BgMeta): number {
  if (m.reaped_at) return m.reaped ?? 0;
  const left = survivors(m.id); if (!left.length) return 0;
  for (const p of left) { try { process.kill(p, "SIGTERM"); } catch { /* gone */ } }
  setTimeout(() => { for (const p of left) { try { process.kill(p, "SIGKILL"); } catch { /* gone */ } } }, 3000).unref();
  try { writeFileSync(f(storeDir, m.id, "json"), JSON.stringify({ ...m, reaped_at: Date.now(), reaped: left.length }, null, 1)); } catch { /* best effort */ }
  return left.length;
}
const row = (storeDir: string, m: BgMeta): BgRow => {
  const ex = f(storeDir, m.id, "exit"), lg = f(storeDir, m.id, "log"), size = existsSync(lg) ? statSync(lg).size : 0;
  if (existsSync(ex)) { reap(storeDir, m); const code = Number(readFileSync(ex, "utf8").trim()), tmo = !!m.timeout_s && (code === 124 || code === 137) && !m.stopped_at; return { ...m, stopped_by: tmo ? "timeout" : m.stopped_by, status: m.stopped_at || tmo ? "stopped" : code === 0 ? "succeeded" : "failed", exit_code: code, ended_at: statSync(ex).mtimeMs, log_bytes: size }; }
  if (m.stopped_at) { if (!alive(m.pid)) reap(storeDir, m); return { ...m, status: "stopped", ended_at: m.stopped_at, log_bytes: size }; }   // a stop was asked: it is stopping (or stopped), never "running" again
  if (alive(m.pid)) return { ...m, status: "running", log_bytes: size };
  reap(storeDir, m);   // the wrapper is gone and left no exit code: whatever it started must not stay open
  return { ...m, status: m.stopped_at ? "stopped" : "interrupted", ended_at: m.stopped_at ?? (existsSync(lg) ? statSync(lg).mtimeMs : undefined), log_bytes: size };
};
export function listBg(storeDir: string, opts: { all?: boolean } = {}): BgRow[] {
  const d = bgDir(storeDir); if (!existsSync(d)) return [];
  const rows = readdirSync(d).filter((n) => n.endsWith(".json")).map((n) => { try { return row(storeDir, JSON.parse(readFileSync(join(d, n), "utf8")) as BgMeta); } catch { return null; } }).filter((x): x is BgRow => !!x);
  return rows.filter((r) => opts.all || r.status === "running").sort((a, b) => b.started - a.started);
}
export const getBg = (storeDir: string, id: string): BgRow | undefined => { try { return row(storeDir, JSON.parse(readFileSync(f(storeDir, id, "json"), "utf8")) as BgMeta); } catch { return undefined; } };
/** The last `tail` lines of the script's output (works for finished scripts too). */
export function bgLog(storeDir: string, id: string, tail = 60): string | undefined {
  const lg = f(storeDir, id, "log"); if (!existsSync(lg)) return undefined;
  const lines = readFileSync(lg, "utf8").replace(/\x1b\[[0-9;]*[A-Za-z]/g, "").split("\n"); return lines.slice(-Math.max(1, tail)).join("\n").slice(-12_000);
}
const descendants = (pid: number): number[] => spawnSync("pgrep", ["-P", String(pid)], { encoding: "utf8" }).stdout.split("\n").filter(Boolean).map(Number).flatMap((c) => [c, ...descendants(c)]);
/** Stop on purpose: SIGTERM to the whole process group (the script and its children), recorded as `stopped`. */
export function stopBg(storeDir: string, id: string, by = "agent"): { ok: boolean; reason?: string; status?: BgStatus } {
  const m = getBg(storeDir, id); if (!m) return { ok: false, reason: "no such background task" };
  if (m.status !== "running") return { ok: true, status: m.status, reason: `it is not running (${m.status})` };
  const meta: BgMeta = { ...m, stopped_at: Date.now(), stopped_by: by }; delete (meta as Partial<BgRow>).status; delete (meta as Partial<BgRow>).log_bytes; delete (meta as Partial<BgRow>).exit_code; delete (meta as Partial<BgRow>).ended_at;
  writeFileSync(f(storeDir, id, "json"), JSON.stringify(meta, null, 1));   // the record first, then the kill: an interrupted run is never mistaken for a deliberate stop
  // the `timeout` wrapper puts the real command in a group of its own, so killing the wrapper's group is not enough: end every descendant (found BEFORE anything dies), then the group
  const tree = descendants(m.pid);
  for (const p of [...tree].reverse()) { try { process.kill(p, "SIGTERM"); } catch { /* gone */ } }
  try { process.kill(-m.pid, "SIGTERM"); } catch { try { process.kill(m.pid, "SIGTERM"); } catch { /* gone already */ } }
  setTimeout(() => { for (const p of tree) { try { process.kill(p, "SIGKILL"); } catch { /* gone */ } } }, 4000).unref();   // whatever ignored SIGTERM
  return { ok: true, status: "stopped" };
}
/** Wait until the URL answers (a dev server is up), the script ends, or the time is up. */
export async function waitReady(storeDir: string, id: string, url: string, sec: number): Promise<{ ready: boolean; status: BgStatus }> {
  for (let i = 0; i < sec; i++) {
    const r = getBg(storeDir, id); if (!r || r.status !== "running") return { ready: false, status: r?.status ?? "interrupted" };
    try { const res = await fetch(url, { signal: AbortSignal.timeout(1500) }); if (res.status < 500) return { ready: true, status: "running" }; } catch { /* not yet */ }
    await new Promise((ok) => setTimeout(ok, 1000));
  }
  return { ready: false, status: getBg(storeDir, id)?.status ?? "interrupted" };
}

/** Run the same command again (same folder, same port, same description): stops it first when it is still running. */
export async function restartBg(storeDir: string, id: string, by = "agent"): Promise<BgMeta | { ok: false; reason: string }> {
  const m = getBg(storeDir, id); if (!m) return { ok: false, reason: "no such background task" };
  if (m.status === "running") { stopBg(storeDir, id, by); await new Promise((ok) => setTimeout(ok, 800)); }
  return startBg(storeDir, { task: m.task, cmd: m.cmd, dir: m.dir, by, title: m.title, label: m.label, port: m.port, publicHost: m.public_url ? new URL(m.public_url).hostname : undefined, timeoutMin: m.timeout_s ? m.timeout_s / 60 : undefined });
}

/** Link a port to a task that was started without one (a server that picked its own port): bg_list and the UI then show its addresses. */
export function linkPort(storeDir: string, id: string, port: number): BgRow | undefined {
  const m = getBg(storeDir, id); if (!m) return undefined;
  const { status: _s, log_bytes: _l, exit_code: _e, ended_at: _a, ...meta } = m;
  writeFileSync(f(storeDir, id, "json"), JSON.stringify({ ...meta, port }, null, 1)); return getBg(storeDir, id);
}
