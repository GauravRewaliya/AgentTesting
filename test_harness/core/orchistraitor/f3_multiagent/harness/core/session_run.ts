// A SESSION RUN is the top-level record of one piece of work: the id you keep and come back to.
//   session_run_id -> its main agent (the lead) and the project manager -> each agent's Claude session id, folder, parents, final answer (the `agents` rows)
//                  -> its plans, notes (the chat), calls, reports, events -> its settings
// Everything is on disk (the registry file here, Postgres in the product), so after the laptop was closed or the machine rebooted `resume` recovers the run:
// agents whose process is gone are marked interrupted, their calls end, their locks are released, running plans are re-queued so every interrupted task
// CONTINUES THE SAME AGENT (the same Claude session; the transcripts are on disk), and a check says whether any session file is missing (a lost context).
import { checkSessionFiles } from "./invariants.ts";
import type { MStore } from "./board.ts";

export const HARNESS_VERSION = "proto-1";
export interface RunConfig { maxDepth: number; runner: "real" | "fake"; locks: "store" | "redis"; locks_url?: string; models?: Record<string, string>; strict: boolean; canary: boolean; sessionCap: number }
export interface SessionRun {
  id: string; task_id: string; title: string; repo: string; status: "active" | "interrupted" | "closed";
  main_agent_id: string | null; main_session_id: string | null; pm_agent_id: string | null; pm_session_id: string | null; plan_ids: string[];
  config: RunConfig; created_at: number; last_active_at: number; resumed_count: number; harness_version: string;
}
/** Passwords never go into the record: keep host and port, drop the credentials (give them again through the environment on resume). */
export const redactUrl = (u?: string) => (u ? u.replace(/\/\/[^@/]*@/, "//") : undefined);
/** How many times a persistent session is resumed before it is rolled (memory lost). One value for the lead, the sub-agents and the defaults. */
export const SESSION_CAP = 8;
export const defaultConfig = (o: Partial<RunConfig> = {}): RunConfig => ({ maxDepth: 4, runner: "real", locks: "store", strict: false, canary: false, sessionCap: SESSION_CAP, ...o, locks_url: redactUrl(o.locks_url) });

export function findRun(store: MStore, ref: { run?: string; task?: string }): SessionRun | undefined {
  return store.runs.find((r) => (ref.run ? r.id === ref.run : r.task_id === ref.task && r.status !== "closed")) ?? (ref.task ? [...store.runs].reverse().find((r) => r.task_id === ref.task) : undefined);
}
/** One active run per task: created on first use, found afterwards. */
export function ensureRun(store: MStore, o: { task_id: string; repo: string; title?: string; config?: Partial<RunConfig> }): SessionRun {
  const have = store.runs.find((r) => r.task_id === o.task_id && r.status !== "closed");
  if (have) { syncRun(store, have); return have; }
  const run: SessionRun = { id: store.uid("run_"), task_id: o.task_id, title: o.title ?? o.task_id, repo: o.repo, status: "active", main_agent_id: null, main_session_id: null, pm_agent_id: null, pm_session_id: null, plan_ids: [],
    config: defaultConfig(o.config), created_at: Date.now(), last_active_at: Date.now(), resumed_count: 0, harness_version: HARNESS_VERSION };
  store.runs.push(run); store.ev("run.created", o.task_id, undefined, { run: run.id }); syncRun(store, run); store.save(); return run;
}
/** Copy the live facts into the run record: who the main agent and the PM are, their Claude session ids, the plans, the time. */
export function syncRun(store: MStore, run: SessionRun) {
  const rows = store.agentsOf(run.task_id), lead = rows.find((a) => a.name === "lead"), pm = rows.find((a) => a.name === "pm");
  run.main_agent_id = lead?.agent_id ?? run.main_agent_id; run.main_session_id = lead?.session_id ?? run.main_session_id;
  run.pm_agent_id = pm?.agent_id ?? run.pm_agent_id; run.pm_session_id = pm?.session_id ?? run.pm_session_id;
  run.plan_ids = store.plans.filter((p) => p.task_id === run.task_id).map((p) => p.plan_id);
  run.last_active_at = Date.now(); store.save();
}
/** Best effort, never throws: called after the main agent or the PM runs and when a plan changes. */
export function touchRun(store: MStore, task_id: string) { try { const r = store.runs.find((x) => x.task_id === task_id && x.status !== "closed"); if (r) syncRun(store, r); } catch { /* the record is a convenience, never a reason to fail a call */ } }

export interface ResumeReport {
  run: SessionRun; interrupted_agents: string[]; ended_calls: string[]; plans_to_restart: string[]; tasks_requeued: string[]; sessions_missing: string[]; skipped_alive: string[];
  main: { agent_id: string | null; session_id: string | null }; pm: { agent_id: string | null; session_id: string | null }; next: string[];
}
/**
 * Recover a run after its processes are gone. An agent still marked running whose last sign of life is older than `staleMs` (or any, with `force`) is treated as cut off:
 * it goes idle, its epoch is bumped (a zombie's late result is discarded), its call ends as 'interrupted'. Its locks are returned in `releaseCalls` for the caller to free (file or Redis).
 * Every running plan is re-queued: the cut-off tasks become pending and CONTINUE THE SAME AGENT. Nothing finished is touched.
 */
export function resumeRun(store: MStore, ref: { run?: string; task?: string }, o: { force?: boolean; staleMs?: number; projectsRoot?: string } = {}): { ok: false; error: string } | { ok: true; report: ResumeReport; releaseCalls: string[] } {
  const run = findRun(store, ref);
  if (!run) return { ok: false, error: `no session run for ${ref.run ?? ref.task}. Known: ${store.runs.map((r) => r.id + " (" + r.task_id + ")").join(", ") || "none"}` };
  if (run.status === "closed" && !o.force) return { ok: false, error: `run ${run.id} is closed; use --force to reopen it` };
  const staleMs = o.staleMs ?? 20_000, now = Date.now(), task = run.task_id;
  const rep: ResumeReport = { run, interrupted_agents: [], ended_calls: [], plans_to_restart: [], tasks_requeued: [], sessions_missing: [], skipped_alive: [], main: { agent_id: null, session_id: null }, pm: { agent_id: null, session_id: null }, next: [] };
  const releaseCalls: string[] = [];
  store.tx(() => {
    for (const a of store.agentsOf(task).filter((x) => x.status === "running" || x.status === "stalled")) {
      if (!o.force && now - a.last_event_at < staleMs) { rep.skipped_alive.push(a.agent_id); continue; }   // seen alive a moment ago: leave it alone
      a.status = "idle"; a.activity = "interrupted (resumed)"; a.epoch = (a.epoch ?? 0) + 1; rep.interrupted_agents.push(a.agent_id);
      store.ev("agent.interrupted", task, a.agent_id, { was: a.status, idle_ms: now - a.last_event_at });
    }
    for (const c of store.calls.filter((x) => x.task_id === task && x.status === "granted" && x.callee_agent_id && rep.interrupted_agents.includes(x.callee_agent_id))) { c.status = "failed"; c.reason = "interrupted"; rep.ended_calls.push(c.id); releaseCalls.push(c.id); }
    for (const p of store.plans.filter((x) => x.task_id === task && (x.status === "running" || x.status === "submitted"))) {
      for (const t of p.tasks) if (t.status === "running" && t.agent_id && rep.interrupted_agents.includes(t.agent_id)) {
        t.status = "pending"; t.session = t.agent_id; t.call_id = undefined; t.error = undefined;
        t.note = "RESUMED AFTER AN INTERRUPTION: the machine or the process stopped while you were working. Continue the same task from what you remember of this conversation; do not start over.";
        rep.tasks_requeued.push(t.id);
      }
      if (p.status === "running") rep.plans_to_restart.push(p.plan_id);
    }
    for (const w of store.waiters.filter((x) => x.task_id === task && releaseCalls.includes(x.call_id))) store.waiters = store.waiters.filter((y) => y !== w);
    rep.sessions_missing = checkSessionFiles(store, task, o.projectsRoot).map((p) => p.detail);
    run.status = "active"; run.resumed_count += 1; syncRun(store, run);
    store.ev("run.resumed", task, undefined, { run: run.id, interrupted: rep.interrupted_agents.length, requeued: rep.tasks_requeued.length, missing: rep.sessions_missing.length });
  });
  rep.main = { agent_id: run.main_agent_id, session_id: run.main_session_id }; rep.pm = { agent_id: run.pm_agent_id, session_id: run.pm_session_id };
  if (rep.sessions_missing.length) rep.next.push("CONTEXT LOST for: " + rep.sessions_missing.join("; ") + " (those agents will start a new session with the ledger brief; check them)");
  if (rep.skipped_alive.length) rep.next.push("still alive (left alone): " + rep.skipped_alive.join(", ") + "; use --force if their processes are really gone");
  rep.next.push(`talk to the project manager: main.ts chat --run ${run.id} --store <file> --say "..."`, `watch it: main.ts board --run ${run.id} --store <file> --watch`);
  return { ok: true, report: rep, releaseCalls };
}
export function renderRuns(store: MStore): string {
  return store.runs.map((r) => `${r.id}  task=${r.task_id}  ${r.status}  main=${r.main_agent_id ?? "-"} session=${(r.main_session_id ?? "-").slice(0, 8)}  pm=${r.pm_agent_id ?? "-"}  plans=[${r.plan_ids.join(",")}]  resumed ${r.resumed_count}x  last active ${new Date(r.last_active_at).toISOString().slice(0, 19)}Z  repo=${r.repo}`).join("\n") || "(no session runs)";
}
