// Registry-wide rules, checkable at any moment (and by the watchdog). Each one has hurt, or would have hurt, a real run.
import { overlaps } from "./locks.ts";
import { HARD_MAX_DEPTH } from "./agent_call.ts";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { projectsRoot, type Store } from "./base.ts";

export interface Problem { rule: string; detail: string }
export function checkRegistry(store: Store, task: string, o: { expectIdle?: boolean } = {}): Problem[] {
  const out: Problem[] = [], rows = store.agentsOf(task), bad = (rule: string, detail: string) => out.push({ rule, detail });
  const bySession = new Map<string, string>();
  for (const a of rows) {
    if (a.session_id) { const prev = bySession.get(a.session_id); if (prev) bad("session_shared", `${prev} and ${a.agent_id} hold the same session ${a.session_id.slice(0, 8)}`); bySession.set(a.session_id, a.agent_id); }
    if (a.level > HARD_MAX_DEPTH) bad("depth_over_limit", `${a.agent_id} is at level ${a.level}`);
    if (a.caller_agent_id) { const c = store.agent(task, a.caller_agent_id); if (!c) bad("orphan_agent", `${a.agent_id} was called by unknown ${a.caller_agent_id}`); else if (!a.parent_agent_id && a.level !== c.level + 1 && a.level !== 1) bad("level_chain", `${a.agent_id} L${a.level} under ${c.agent_id} L${c.level}`); }
    if (o.expectIdle && (a.status === "running" || a.status === "stalled")) bad("agent_left_running", `${a.agent_id} is ${a.status} (${a.activity})`);
  }
  const locks = store.locks.filter((l) => l.task_id === task);
  for (let i = 0; i < locks.length; i++) for (let j = i + 1; j < locks.length; j++)
    if (locks[i]!.agent_id !== locks[j]!.agent_id && overlaps(locks[i]!.path, locks[j]!.path)) bad("lock_overlap", `${locks[i]!.agent_id} holds ${locks[i]!.path} and ${locks[j]!.agent_id} holds ${locks[j]!.path}`);
  for (const w of store.waiters.filter((x) => x.task_id === task)) if (!store.calls.some((c) => c.id === w.call_id)) bad("orphan_waiter", `waiter for unknown call ${w.call_id}`);
  if (o.expectIdle) for (const a of rows) {   // every start has exactly one end (done, failed or stopped): the "exactly one terminal event" rule
    const starts = store.events.filter((e) => e.task_id === task && e.agent_id === a.agent_id && e.kind === "agent.start").length;
    const ends = store.events.filter((e) => e.task_id === task && e.agent_id === a.agent_id && (e.kind === "agent.done" || e.kind === "agent.failed" || (e.kind === "agent.stopped" && !e.data?.cascade))).length;
    if (starts !== ends) bad("unpaired_events", `${a.agent_id} has ${starts} start(s) and ${ends} end(s)`);
  }
  if (o.expectIdle) for (const l of locks) bad("lock_leak", `${l.agent_id} still holds ${l.path} after the work ended`);
  for (const c of store.calls.filter((x) => x.task_id === task && x.status === "granted")) {
    const a = c.callee_agent_id ? store.agent(task, c.callee_agent_id) : null;
    if (o.expectIdle && a && a.status === "idle" && !store.waiters.some((w) => w.call_id === c.id)) bad("call_not_finalised", `call ${c.id} to ${a.agent_id} is still 'granted' but the agent is idle`);
  }
  return out;
}
/** The registry says an agent has a session: its transcript must really be on disk (in any project folder, as the CLI looks). Run it after every message of a real run. */
export function checkSessionFiles(store: Store, task: string, root = projectsRoot()): Problem[] {
  let dirs: string[] = []; try { dirs = readdirSync(root); } catch { /* none yet */ }
  return store.agentsOf(task).filter((a) => a.session_id && (a.runs ?? 0) > 0 && a.status !== "failed" && !dirs.some((d) => existsSync(join(root, d, a.session_id + ".jsonl"))))
    .map((a) => ({ rule: "session_not_on_disk", detail: `${a.agent_id} has session ${a.session_id!.slice(0, 8)} in the registry but no transcript file exists` }));
}
/** Record every problem as an invariant.violation (throws on the first one in strict mode). */
export function assertRegistry(store: Store, task: string, o: { expectIdle?: boolean } = {}): Problem[] {
  const ps = checkRegistry(store, task, o);
  for (const p of ps) store.violation(p.rule, task, undefined, { detail: p.detail });
  return ps;
}
