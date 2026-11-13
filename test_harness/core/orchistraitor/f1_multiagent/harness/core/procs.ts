// The host processes of ONE task = every process whose working folder is inside that task's workspace (dev servers, installs, shells an agent left running).
// Shared by the UI (Experiment page: stop a process) and the agents (`tools.ts proc_list | proc_stop --pid`), so the team sees and manages the same things.
// Safe by construction: only processes INSIDE the workspace are listed or stopped; the harness itself (claude agents, bun tools.ts/testrun, docker clients) is never touched.
import { spawnSync } from "node:child_process";
import { readdirSync, readlinkSync } from "node:fs";
import { resolve } from "node:path";

export interface Proc { pid: number; elapsed: string; cmd: string }
const PROTECTED = /(^|\/)claude(\s|$)|tools\.ts|testrun\/|bun .*server\/index\.ts|^docker |\/docker /;
const cwdOf = (pid: number) => { try { return readlinkSync(`/proc/${pid}/cwd`); } catch { return ""; } };
const inside = (cwd: string, root: string) => cwd === root || cwd.startsWith(root + "/");

export function listTaskProcs(workspace: string): Proc[] {
  const root = resolve(workspace), out: Proc[] = [];
  let pids: number[] = []; try { pids = readdirSync("/proc").filter((n) => /^\d+$/.test(n)).map(Number); } catch { return []; }
  for (const pid of pids) {
    if (pid === process.pid || !inside(cwdOf(pid), root)) continue;
    const r = spawnSync("ps", ["-o", "etime=,args=", "-p", String(pid)], { encoding: "utf8" }).stdout.trim(), m = r.match(/^(\S+)\s+(.*)$/);
    if (m && !PROTECTED.test(m[2]!)) out.push({ pid, elapsed: m[1]!, cmd: m[2]!.replace(/\s+/g, " ").slice(0, 200) });
  }
  return out;
}
const children = (pid: number): number[] => spawnSync("pgrep", ["-P", String(pid)], { encoding: "utf8" }).stdout.split("\n").filter(Boolean).map(Number).flatMap((c) => [...children(c), c]);
export function stopTaskProc(workspace: string, pid: number): { ok: boolean; stopped?: number[]; reason?: string } {
  const root = resolve(workspace), p = listTaskProcs(root).find((x) => x.pid === pid);
  if (!p) return { ok: false, reason: `pid ${pid} is not a stoppable process of this workspace (only processes working inside it, and never the harness itself)` };
  const all = [...children(pid), pid];
  for (const x of all) { try { process.kill(x, "SIGTERM"); } catch { /* already gone */ } }
  return { ok: true, stopped: all };
}
