// UI API for BACKGROUND SCRIPTS of a session (harness/core/bg.ts: record + status + log, run on the host) and the host processes in its workspace.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { STATE2_BASE } from "@core/paths.ts";
import { bgLog, getBg, listBg, restartBg, stopBg } from "@core/orchistraitor/f1_multiagent/harness/core/bg.ts";
import { publicHost } from "@core/orchistraitor/f1_multiagent/harness/core/preview.ts";
import { listTaskProcs, stopTaskProc } from "@core/orchistraitor/f1_multiagent/harness/core/procs.ts";

const safe = (t: string) => t.replace(/[^\w.-]/g, "");
export const taskWorkspace = (task: string) => join(STATE2_BASE, "v1", safe(task), "workspace");
const storeDir = (task: string) => join(STATE2_BASE, "v1", safe(task), "store");
const pub = (r: ReturnType<typeof listBg>[number]) => ({ id: r.id, title: r.title ?? "server_run", status: r.status, label: r.label, cmd: r.cmd.slice(0, 160), dir: r.dir, pid: r.pid, port: r.port, started: r.started, ended_at: r.ended_at, exit_code: r.exit_code, by: r.by, stopped_by: r.stopped_by, public_url: r.port ? `http://${publicHost()}:${r.port}` : "" });
export type BgScript = ReturnType<typeof pub>;

/** Every background script of the session (running first), for the header badge. */
export const bgOf = (task: string) => ({ scripts: listBg(storeDir(task), { all: true }).sort((a, b) => Number(b.status === "running") - Number(a.status === "running") || b.started - a.started).slice(0, 30).map(pub) });
export const scriptLog = (task: string, id: string, tail = 80) => ({ ok: !!getBg(storeDir(task), id), log: bgLog(storeDir(task), id, tail) ?? "" });
export const stopScript = (task: string, id: string) => stopBg(storeDir(task), id, "user");
export async function restartScript(task: string, id: string) { const r = await restartBg(storeDir(task), id, "user"); return "id" in r ? { ok: true } : r; }
export const taskProcs = (task: string) => listTaskProcs(taskWorkspace(task));
export const stopProc = (task: string, pid: number) => stopTaskProc(taskWorkspace(task), pid);

/** The admin bug tracker of a session: what agents (and the harness) reported with `team report_bug` (harness/tools.ts -> store/admin_issues.jsonl). Newest first. Re-read only when the file changed (mtime + size). */
import type { BugReport, EvidenceItem, EvidenceOut } from "../shared/experiment";
const bugCache = new Map<string, { sig: string; rows: BugReport[] }>();
export const bugsOf = (task: string): { count: number; high: number; reports: BugReport[] } => {
  const f = join(storeDir(task), "admin_issues.jsonl");
  if (!existsSync(f)) return { count: 0, high: 0, reports: [] };
  const st = statSync(f), sig = st.mtimeMs + ":" + st.size, hit = bugCache.get(f);
  let rows = hit && hit.sig === sig ? hit.rows : null;
  if (!rows) {
    rows = readFileSync(f, "utf8").split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l) as Record<string, unknown>; } catch { return null; } }).filter((x): x is Record<string, unknown> => !!x)
      .map((r) => ({ id: String(r.id ?? ""), at: String(r.at ?? ""), t: Number(r.t ?? 0), reporter: String(r.reporter ?? ""), agent: (r.agent as string) ?? null, role: (r.role as string) ?? null, session_id: (r.session_id as string) ?? null, kind: String(r.kind ?? "bug"), severity: String(r.severity ?? "medium"), text: String(r.text ?? ""), status: (r.status as string) ?? null, running_s: (r.running_s as number) ?? null, log_file: (r.log_file as string) ?? null }))
      .sort((a, b) => b.t - a.t).slice(0, 100);
    bugCache.set(f, { sig, rows });
  }
  return { count: rows.length, high: rows.filter((r) => r.severity === "high").length, reports: rows };
};

// ---- EVIDENCE of a session: the pictures and videos agents made, so a person SEES them (the files were always on disk, nothing showed them).
// Three folders, all inside the session: store/qa (the test runner's --video and QA containers), workspace/run_test/_shots (`browse`, any agent) and workspace/run_test/_qa.
const EV_EXT: Record<string, "image" | "video" | "text"> = { png: "image", jpg: "image", jpeg: "image", webp: "image", gif: "image", webm: "video", mp4: "video", txt: "text" };
const evRoots = (task: string) => ({ qa: join(storeDir(task), "qa"), shots: join(taskWorkspace(task), "run_test", "_shots"), qa_rec: join(taskWorkspace(task), "run_test", "_qa") });
const evWalk = (root: string, rel = "", depth = 0): { rel: string; size: number; t: number }[] => {
  if (depth > 3 || !existsSync(join(root, rel))) return [];
  return readdirSync(join(root, rel), { withFileTypes: true }).flatMap((e) => { const r = rel ? rel + "/" + e.name : e.name; if (e.isDirectory()) return evWalk(root, r, depth + 1); try { const st = statSync(join(root, r)); return [{ rel: r, size: st.size, t: Math.round(st.mtimeMs) }]; } catch { return []; } });
};
/** Newest first, at most 80. Only pictures, videos and the plain-text reports (REPORT.txt): never code, JSON or logs. */
export function evidenceOf(task: string): EvidenceOut {
  const safeTask = task.replace(/[^\w.-]/g, ""), items: EvidenceItem[] = [];
  for (const [root, dir] of Object.entries(evRoots(safeTask)) as ["qa" | "shots" | "qa_rec", string][]) for (const f of evWalk(dir)) {
    const kind = EV_EXT[(f.rel.split(".").pop() ?? "").toLowerCase()]; if (!kind || (kind === "text" && !/REPORT\.txt$/.test(f.rel))) continue;
    items.push({ name: f.rel, root, rel: f.rel, kind, size: f.size, t: f.t, url: `/api/evidence/${safeTask}/${root}/${f.rel.split("/").map(encodeURIComponent).join("/")}` });
  }
  items.sort((a, b) => b.t - a.t); const top = items.slice(0, 80);
  return { count: items.length, images: items.filter((x) => x.kind === "image").length, videos: items.filter((x) => x.kind === "video").length, items: top };
}
/** The absolute path of one evidence file, or undefined: the root must be one of the three, the path may not leave it, and only the allowed kinds are served. */
export function evidenceFile(task: string, root: string, rel: string): string | undefined {
  const roots = evRoots(task.replace(/[^\w.-]/g, "")) as Record<string, string>, base = roots[root]; if (!base || !rel || rel.split("/").some((x) => x === ".." || x === "." || x === "")) return undefined;
  const ext = (rel.split(".").pop() ?? "").toLowerCase(), kind = EV_EXT[ext]; if (!kind || (kind === "text" && !/REPORT\.txt$/.test(rel))) return undefined;
  const abs = join(base, rel); return abs.startsWith(base + "/") && existsSync(abs) ? abs : undefined;
}

