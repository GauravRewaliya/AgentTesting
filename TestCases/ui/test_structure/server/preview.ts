// UI API for BACKGROUND SCRIPTS of a session (harness/core/bg.ts: record + status + log, run on the host) and the host processes in its workspace.
import { join } from "node:path";
import { STATE2_BASE } from "@core/paths.ts";
import { bgLog, getBg, listBg, stopBg } from "@core/orchistraitor/f1_multiagent/harness/core/bg.ts";
import { startPreview } from "@core/orchistraitor/f1_multiagent/harness/core/preview.ts";
import { listTaskProcs, stopTaskProc } from "@core/orchistraitor/f1_multiagent/harness/core/procs.ts";

const safe = (t: string) => t.replace(/[^\w.-]/g, "");
export const taskWorkspace = (task: string) => join(STATE2_BASE, "v1", safe(task), "workspace");
const storeDir = (task: string) => join(STATE2_BASE, "v1", safe(task), "store");
const pub = (r: ReturnType<typeof listBg>[number]) => ({ id: r.id, kind: r.kind, status: r.status, label: r.label, cmd: r.cmd.slice(0, 160), dir: r.dir, pid: r.pid, started: r.started, ended_at: r.ended_at, exit_code: r.exit_code, by: r.by, stopped_by: r.stopped_by, public_url: r.public_url ?? "", expires_at: r.expires_at, user_requested: !!r.user_requested });
export type BgScript = ReturnType<typeof pub>;

/** Every background script of the session (running first), for the header badge. */
export const bgOf = (task: string) => ({ scripts: listBg(storeDir(task), { all: true }).sort((a, b) => Number(b.status === "running") - Number(a.status === "running") || b.started - a.started).slice(0, 30).map(pub) });
export const scriptLog = (task: string, id: string, tail = 80) => ({ ok: !!getBg(storeDir(task), id), log: bgLog(storeDir(task), id, tail) ?? "" });
export const stopScript = (task: string, id: string) => stopBg(storeDir(task), id, "user");
export async function restartScript(task: string, id: string) {
  const old = getBg(storeDir(task), id); if (!old) return { ok: false, reason: "no such script" };
  stopBg(storeDir(task), id, "user"); await new Promise((r) => setTimeout(r, 800));
  if (old.kind === "preview") { const r = await startPreview({ storeDir: storeDir(task), task, dir: old.dir, allowedRoot: taskWorkspace(task), by: "user", waitSec: 5, userRequested: old.user_requested }); return r.ok ? { ok: true } : r; }
  const { startBg } = await import("@core/orchistraitor/f1_multiagent/harness/core/bg.ts"); startBg(storeDir(task), { task, cmd: old.cmd, dir: old.dir, by: "user", label: old.label, port: old.port, userRequested: old.user_requested }); return { ok: true };
}
export const taskProcs = (task: string) => listTaskProcs(taskWorkspace(task));
export const stopProc = (task: string, pid: number) => stopTaskProc(taskWorkspace(task), pid);
