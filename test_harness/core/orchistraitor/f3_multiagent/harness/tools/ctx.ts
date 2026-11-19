// SHARED CONTEXT of every tool command: the arguments (cmd, rest, flag), the environment of THIS agent (store file, task, me, workspace), the open store, the helpers every group uses.
// One process = one command, so module-level state read from argv/env is fine. The command groups are the other files of this folder; index.ts routes to them.
import { dirname, join, resolve } from "node:path";
import { normalize } from "../core/help.ts";
import { fileURLToPath } from "node:url";
import { defaultPolicy, stopAgent } from "../core/agent_call.ts";
import { loadAgents } from "../core/base.ts";
import { MStore, say } from "../core/board.ts";
import { attention, dueAutoStops, dueNudges, nudgeText } from "../core/monitor.ts";
import { locksFromEnv } from "../core/lockapi.ts";
import { appendFileSync, existsSync } from "node:fs";

export const MAX_WAVE = 4;
export const HDIR = join(dirname(fileURLToPath(import.meta.url)), ".."), TOOLS = `bun ${join(HDIR, "tools.ts")}`;
export const [cmd, ...rest] = normalize(process.argv.slice(2));
export const flag = (k: string) => { const i = rest.indexOf("--" + k); return i >= 0 ? rest[i + 1] : undefined; };
export const E = process.env, file = E.HARNESS_STORE!, task = flag("task") ?? E.HARNESS_TASK!, me = E.HARNESS_AGENT ?? "";
export const out = (o: unknown) => console.log(JSON.stringify(o));
/** A project folder / file named by an agent, from wherever it stands: its own shell folder, the workspace, or run_test/ (agents wrote `--dir .`, `run_test/x`, `x`, absolute paths: each of them works). Always inside the workspace. */
export const inWs = (p: string) => p === resolve(cwd) || p.startsWith(resolve(cwd) + "/");
export const projPath = (x: string, mustHave = "index.html") => { const c = [resolve(process.cwd(), x), resolve(cwd, x), resolve(cwd, "run_test", x.replace(/^\.?\/?(run_test\/)?/, ""))].filter(inWs); return c.find((d) => existsSync(join(d, mustHave))) ?? c.find((d) => existsSync(d)) ?? c[0] ?? resolve(cwd, "run_test"); };
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
if (!file || !task) { out({ ok: false, reason: "tool environment missing (HARNESS_STORE/TASK)" }); process.exit(0); }

export const store = new MStore(file), defs = loadAgents();
/** An issue for the admins: append-only log next to the store (session id included) + an `admin.issue` event. Used by report_bug and by the harness backstop. */
export const logIssue = (o: { agent?: string; kind: string; text: string; reporter: string; session_id?: string | null; severity?: string }) => {
  store.reload(); const a = o.agent ? store.agent(task, o.agent) : undefined, ts = a ? store.events.filter((e) => e.task_id === task && e.agent_id === a.agent_id && e.kind === "tool.used").map((e) => e.t) : [];
  const rec = { id: "iss_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), t: Date.now(), at: new Date().toISOString(), task, reporter: o.reporter, agent: o.agent || null, role: a?.role ?? null, session_id: o.session_id ?? a?.session_id ?? null, kind: o.kind, severity: o.severity ?? "medium", log_file: a?.log_file ?? null, status: a?.status ?? null, activity: a?.activity ?? null, running_s: a?.started_at && a.status === "running" ? Math.round((Date.now() - a.started_at) / 1000) : null, last_tool_s_ago: ts.length ? Math.round((Date.now() - Math.max(...ts)) / 1000) : null, tool_calls: ts.length, text: o.text.slice(0, 2000) };
  appendFileSync(join(dirname(file), "admin_issues.jsonl"), JSON.stringify(rec) + "\n");
  store.ev("admin.issue", task, o.reporter, { id: rec.id, agent: rec.agent, kind: o.kind, session_id: rec.session_id }); store.save(); return rec;
};
/** The harness watches while the lead is blocked in `wait` / `plan_status` (throttled to every 10 s, free): ONE status nudge to an agent over 6 min (core/monitor.ts), and a BACKSTOP: an agent with no tool call for 10 min is stopped, its locks released, and the issue logged + the lead told. Returns true when the lead is needed NOW. */
/** Has any WRITER (builder, ux-designer ... anything whose agent.json says writes) worked in THIS task? Without one there is nothing new to verify: the QA agent is not started unless the person asked (--user-asked). Resumed turns of the same task still count (the agents stay in the store). */
export const writerRanInTask = () => store.agentsOf(task).some((a) => a.name !== "lead" && defs.get(a.name)?.writes === true && (a.runs ?? 0) > 0);
export let lastMonitorTick = 0;
export const monitorTick = async (only?: string[]): Promise<boolean> => {
  if (Date.now() - lastMonitorTick < 10_000) return false; lastMonitorTick = Date.now();
  try {
    for (const d of dueNudges(store, task)) store.tx(() => { say(store, task, "harness", d.agent_id, nudgeText(d.running_s)); store.ev("monitor.nudge", task, d.agent_id, { started_at: d.started_at, running_s: d.running_s }); });
    for (const d of dueAutoStops(store, task)) {
      let stopped: string[] = [];
      store.tx(() => { stopAgent(store, task, d.agent_id); stopped = store.calls.filter((x) => x.status === "failed" && x.reason === "stopped").map((x) => x.id); store.ev("monitor.autostop", task, d.agent_id, { silent_s: d.silent_s, running_s: d.running_s }); });
      for (const c of stopped) await locks.release(task, c, policy.lockTtlMs);
      logIssue({ agent: d.agent_id, kind: "stalled", reporter: "harness", text: `No tool call for ${d.silent_s}s (running ${d.running_s}s) and nobody acted: stopped by the harness backstop. Its files are kept; check them before starting a replacement.` });
      const lead = store.agentsOf(task).find((a) => a.name === "lead"); if (lead) store.tx(() => { say(store, task, "harness", lead.agent_id, `${d.agent_id} had no tool call for ${Math.round(d.silent_s / 60)} min and was STOPPED by the harness. Check its files yourself (read_file, a check) before you start a replacement: it may be complete.`); });
    }
    return attention(store, task, only).some((x) => x.level === "stalled" || x.level === "asks");
  } catch { return false; /* monitoring never breaks a command */ }
};
export const attentionSpread = (only?: string[]) => { try { const x = attention(store, task, only); return x.length ? { attention: x } : {}; } catch { return {}; } };
// per-agent model: HARNESS_MODELS='{"researcher":"sonnet"}' overrides agent.json for this launch
for (const [n, m] of Object.entries(JSON.parse(E.HARNESS_MODELS ?? "{}") as Record<string, string>)) { const d = defs.get(n); if (d) d.model = m; }
{ const only = E.HARNESS_LEAD_AGENTS, ld = defs.get("lead"); if (only !== undefined && ld) ld.agents = only.split(",").filter(Boolean); }   // a test case decides which agents its lead has
export const locks = locksFromEnv(store);
export const policy = defaultPolicy({ agentMaxDepth: Number(E.HARNESS_MAX_DEPTH ?? 1), maxInstancesPerRole: Number(E.HARNESS_MAX_INSTANCES ?? 4), externalLocks: locks.kind === "redis", lockTtlMs: Number(E.HARNESS_LOCK_TTL_MS ?? 1_200_000), budgetUsd: Number(E.HARNESS_PROJECT_BUDGET_USD ?? 0) });
export const cwd = E.HARNESS_CWD ?? process.cwd();
/** The QA agent works in a throwaway COPY (HARNESS_CWD = the copy); everything that must outlive the call (QA memory, videos, checkpoints) goes to the REAL workspace. */
export const realCwd = E.HARNESS_REAL_CWD ?? cwd;
