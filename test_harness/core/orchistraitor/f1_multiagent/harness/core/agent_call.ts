// The BE command `agent.call` (plan section 21): the one authority on whether a call is allowed. Every call, granted or denied, is recorded.
import { acquire, isResource } from "./locks.ts";
import type { AgentDef, AgentRow, Store } from "./base.ts";
import { customDef, isCustomName } from "./custom.ts";

export const HARD_MAX_DEPTH = 4;
export interface Policy { externalLocks?: boolean; agentMaxDepth: number; taskMaxAgents: number; maxInstancesPerRole: number; killSwitch: boolean; spendPaused: boolean; lockTtlMs: number }
/** Multi-agent is OFF by default: agentMaxDepth 1 means the lead (level 1) cannot call anyone. */
export const defaultPolicy = (o: Partial<Policy> = {}): Policy => ({ agentMaxDepth: 1, taskMaxAgents: 12, maxInstancesPerRole: 4, killSwitch: false, spendPaused: false, lockTtlMs: 120_000, ...o });

export interface CallReq {
  task_id: string; caller_agent_id: string; role: string; session_arg?: string; mode?: "work" | "ask";
  objective?: string; output?: string; boundaries?: string; writes?: string[]; onBehalf?: boolean;
  title?: string;   // what an agent without a folder is FOR ("researcher: compare 3 bundlers"); used when the caller may make custom agents   // onBehalf: the plan scheduler calls for its owner after the owner's turn ended
}
export type CallRes =
  | { ok: true; call_id: string; agent: AgentRow; level: number; kind: "new" | "resume" | "fork"; forkFrom?: AgentRow; queued?: { position: number; heldBy: string[] }; needLocks?: string[] }
  | { ok: false; call_id: string; code: string; reason: string };

export function agentCall(store: Store, defs: Map<string, AgentDef>, policy: Policy, req: CallReq, now = Date.now()): CallRes {
  const call_id = store.uid("call_");
  const deny = (code: string, reason: string, level = 0): CallRes => {
    store.calls.push({ id: call_id, task_id: req.task_id, caller_agent_id: req.caller_agent_id, callee_agent_id: null, role: req.role, level, session_arg: req.session_arg ?? "", status: "denied", reason: `${code}: ${reason}`, t: now });
    store.ev("agent.call.denied", req.task_id, req.caller_agent_id, { role: req.role, code, reason }); store.save();
    return { ok: false, call_id, code, reason: `${code}: ${reason}` };
  };
  const stop = store.aborted();
  if (stop) return deny("aborted", `the run was stopped by the watchdog: ${stop}`);
  // 8 (first, it is cheapest): kill switch and spend guard
  if (policy.killSwitch) return deny("kill_switch", "the kill switch is on; no new agent may start");
  if (policy.spendPaused) return deny("spend_paused", "spending is paused for this team");
  // 1 caller is live and inside the task
  const caller = store.agent(req.task_id, req.caller_agent_id);
  if (!caller || (caller.status !== "running" && !(req.onBehalf && caller))) return deny("caller_not_live", `${req.caller_agent_id} is not a running agent of task ${req.task_id}`);
  // The lead may say "builder" (the agent's name) or "build" (its role in agent.json): both mean the same agent. A real session got "unknown_role: build" and lost a turn.
  if (!defs.has(req.role)) { const byRole = [...defs.values()].filter((d) => d.role === req.role); if (byRole.length === 1) req = { ...req, role: byRole[0]!.name }; }
  const callerDef = defs.get(caller.name);
  if (!callerDef) return deny("caller_not_live", `no definition for ${caller.name}`);
  // A role with no folder: a caller marked "custom" gets a generic sub-agent with that name and the title it gave (so it knows what it is), instead of a refusal.
  let adHoc = false;
  if (!defs.has(req.role) && callerDef.custom) {
    if (!isCustomName(req.role)) return deny("bad_custom_name", `"${req.role}" is not a usable agent name: use lower-case letters, digits and "-" (2 to 32 characters), for example "market-researcher"`);
    if (!req.title?.trim()) return deny("title_required", `"${req.role}" is not one of the defined agents (${callerDef.agents.join(", ")}). To use a custom agent, pass --title "<what this agent is for>"`);
    defs.set(req.role, customDef(req.role, req.title, !!req.writes?.length)); adHoc = true;
  }
  const calleeDef = defs.get(req.role);
  if (!calleeDef) return deny("unknown_role", `no agent named "${req.role}". ${callerDef.agents.length ? `Use one of: ${callerDef.agents.join(", ")}` : "You may not call anyone"}`);
  if (calleeDef.forbidden) { store.ev("guard.forbidden", req.task_id, caller.agent_id, { role: req.role }); return deny("forbidden", `${req.role} is not useful for this work and must not be called`); }
  // 3 depth (checked before 2 so "multi-agent is off" is the message when it is off)
  const level = caller.level + 1, limit = Math.min(policy.agentMaxDepth, HARD_MAX_DEPTH);
  if (level > limit) return deny("depth_exceeded", policy.agentMaxDepth <= 1 ? "multi-agent is off (agent_max_depth=1); do the work in the pipeline instead" : `level ${level} is deeper than the limit ${limit}`, level);
  // 2 declared in the caller's agent.json agents[]
  if (!adHoc && !defs.get(req.role)?.ad_hoc && !callerDef.agents.includes(req.role)) return deny("not_declared", `${caller.name} may call: [${callerDef.agents.join(", ")}]`, level);
  // 4 no cycle: the callee may not already be on the chain above the caller
  const chain: string[] = []; for (let c: AgentRow | undefined = caller; c; c = c.caller_agent_id ? store.agent(req.task_id, c.caller_agent_id) : undefined) chain.push(c.name);
  if (chain.includes(req.role)) return deny("cycle", `${chain.reverse().join(" -> ")} -> ${req.role}`, level);
  // 5 fan-out
  const live = store.agentsOf(req.task_id).filter((a) => a.status === "running");
  if (live.filter((a) => a.caller_agent_id === caller.agent_id).length >= callerDef.max_children) return deny("fan_out", `${caller.agent_id} already has ${callerDef.max_children} live sub-agents (max_children)`, level);
  if (live.length >= policy.taskMaxAgents) return deny("task_agent_limit", `${live.length} agents are already live on this task`, level);
  // the three structured fields (objective, output, boundaries): vague calls make agents repeat each other
  for (const f of ["objective", "output", "boundaries"] as const) if (!req[f]?.trim()) return deny("missing_field", `--${f} is required: say what you want, in which format, and what the agent must not do`, level);
  // 6 session rules
  const s = req.session_arg?.trim();
  if (!s) return deny("session_required", 'pass --session "new", "<agent_id>" (continue it) or "fork:<agent_id>" (start from a copy of its memory)', level);
  const sameRole = () => store.agentsOf(req.task_id).filter((a) => a.name === req.role).length;
  let target: AgentRow | undefined, kind: "new" | "resume" | "fork" = "new", forkFrom: AgentRow | undefined;
  if (s === "new") { if (sameRole() >= policy.maxInstancesPerRole) return deny("instance_limit", `${sameRole()} ${req.role} agents already exist (limit ${policy.maxInstancesPerRole}); continue one instead`, level); }
  else if (s.startsWith("fork:")) {
    forkFrom = store.agent(req.task_id, s.slice(5));
    if (!forkFrom) return deny("agent_not_in_task", `"${s.slice(5)}" is not an agent of this task`, level);
    if (forkFrom.name !== req.role) return deny("wrong_role", `${forkFrom.agent_id} is a ${forkFrom.name}, not a ${req.role}`, level);
    if (!forkFrom.session_id) return deny("fork_source_invalid", `${forkFrom.agent_id} has no session yet to copy`, level);
    if (sameRole() >= policy.maxInstancesPerRole) return deny("instance_limit", `limit ${policy.maxInstancesPerRole} ${req.role} agents`, level);
    kind = "fork";
  } else {
    target = store.agent(req.task_id, s);
    if (!target) return deny("agent_not_in_task", `"${s}" is not an agent of this task. Known: [${store.agentsOf(req.task_id).filter((a) => a.name === req.role).map((a) => a.agent_id).join(", ")}]. Use "new" for a new one`, level);
    if (target.name !== req.role) return deny("wrong_role", `${target.agent_id} is a ${target.name}, not a ${req.role}`, level);
    if (target.status === "running") return deny("agent_busy", `${target.agent_id} is still working; leave it a note with say instead of calling it`, level);
    kind = "resume";
  }
  // 7 locks: a writer must declare what it will write; a read-only agent must not
  const work = (req.mode ?? "work") === "work";
  if (calleeDef.writes && work && !req.writes?.length) return deny("writes_required", `${req.role} can write files: pass --writes with the paths or globs it may change`, level);
  if (!calleeDef.writes && req.writes?.some((w) => !isResource(w))) return deny("readonly_declared_writes", `${req.role} is read-only; it cannot hold FILE locks (it may declare resources such as @tests)`, level);
  // granted: create or reuse the row
  const agent = target ?? store.addAgent(req.task_id, calleeDef, { caller: caller.agent_id, level, parent: forkFrom?.agent_id ?? null, parentSession: forkFrom?.session_id ?? caller.session_id ?? null, type: forkFrom ? "fork" : "call" });
  // a resumed agent keeps its own owner and level (it may be continued by a different caller, e.g. a builder asking researcher#3 for more)
  const row = { id: call_id, task_id: req.task_id, caller_agent_id: caller.agent_id, callee_agent_id: agent.agent_id, role: req.role, level, session_arg: s, status: "granted" as const, reason: null as string | null, t: now, req: { ...req } as Record<string, unknown> };
  let queued: { position: number; heldBy: string[] } | undefined, needLocks: string[] | undefined;
  if (work && req.writes?.length && policy.externalLocks) needLocks = req.writes;   // the caller takes them through the lock API (Redis) before anything starts
  else if (work && req.writes?.length) {
    const r = acquire(store, { task_id: req.task_id, agent_id: agent.agent_id, call_id, paths: req.writes!, ttlMs: policy.lockTtlMs, now });
    if (!r.ok) { queued = { position: r.position, heldBy: r.heldBy }; row.reason = `queued behind ${r.heldBy.join(",")}`; }
  }
  if (req.title?.trim() && (calleeDef.ad_hoc || !agent.title || agent.title === agent.name)) agent.title = req.title.trim().slice(0, 80);
  store.calls.push(row); store.ev("agent.call.granted", req.task_id, caller.agent_id, { callee: agent.agent_id, level, kind, queued: !!queued, ...(calleeDef.ad_hoc ? { custom: true, title: agent.title } : {}) }); store.save();
  return { ok: true, call_id, agent, level, kind, forkFrom, queued, needLocks };
}

/** Everything below `agent_id` in the call tree (for cancel and cost roll-up). */
export function descendants(store: Store, task_id: string, agent_id: string): AgentRow[] {
  const out: AgentRow[] = [], todo = [agent_id];
  while (todo.length) { const id = todo.pop()!; for (const a of store.agentsOf(task_id)) if (a.caller_agent_id === id && !out.includes(a)) { out.push(a); todo.push(a.agent_id); } }
  return out;
}
/** Stop an agent and everything it called. The session is kept; locks are freed by the caller via release(). */
export function stopAgent(store: Store, task_id: string, agent_id: string): AgentRow[] {
  const rows = [store.agent(task_id, agent_id)!, ...descendants(store, task_id, agent_id)].filter(Boolean);
  for (const r of rows) if (r.status === "running") { r.status = "idle"; r.activity = "stopped"; r.epoch = (r.epoch ?? 0) + 1; }
  for (const c of store.calls) if (c.status === "granted" && rows.some((r) => r.agent_id === c.callee_agent_id)) { c.status = "failed"; c.reason = "stopped"; }
  store.ev("agent.stopped", task_id, agent_id, { cascade: rows.length }); store.save(); return rows;
}
export function markStalled(store: Store, now: number, stallMs: number): AgentRow[] {
  const out = store.agents.filter((a) => a.status === "running" && now - a.last_event_at > stallMs);
  for (const a of out) { a.status = "stalled"; store.ev("agent.stalled", a.task_id, a.agent_id, { idle_ms: now - a.last_event_at }); }
  if (out.length) store.save(); return out;
}
/** Spend rolls up the tree: an agent's cost plus everything it called. */
export function costOf(store: Store, task_id: string, agent_id: string): number {
  const ids = new Set([agent_id, ...descendants(store, task_id, agent_id).map((a) => a.agent_id)]);
  return store.reports.filter((r) => r.task_id === task_id && ids.has(r.agent_id)).reduce((s, r) => s + r.cost, 0);
}
