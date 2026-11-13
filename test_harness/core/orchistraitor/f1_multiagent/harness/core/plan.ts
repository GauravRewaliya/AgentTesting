// Work splitting as DATA (plan 27.3): the lead declares tasks with an owner role, dependencies and the files a writer will touch; the harness
// validates the split, computes the waves that can run in parallel, runs them, and hands each task the results of the tasks it depends on.
// A bad split is REJECTED up front with every reason and nothing is started.
import { similar } from "./base.ts";
import { modelProblem } from "./models.ts";
import { overlaps } from "./locks.ts";
import type { AgentDef, Store } from "./base.ts";
import type { Policy } from "./agent_call.ts";

export interface PlanTask { id: string; role: string; objective: string; output: string; boundaries: string; deps?: string[]; writes?: string[]; session?: string; note?: string; question?: string; phase?: number; model?: string }
export type TaskState = "pending" | "running" | "done" | "failed" | "skipped" | "cancelled" | "blocked";   // blocked: its agent stopped to ask its parent
export interface PlanRow {
  task_id: string; plan_id: string; owner: string; waves: string[][]; status: "submitted" | "running" | "done" | "failed" | "aborted"; created: number;
  paused?: boolean; gates?: Record<number, { t: number; by: string; evidence: string }>; version?: number; changes?: { v: number; t: number; by: string; reason: string; summary: string }[];
  tasks: (PlanTask & { status: TaskState; agent_id?: string; call_id?: string; report_id?: string; error?: string })[];
}
export const MAX_PLAN_TASKS = 12, MAX_WAVE = 4;

export type Validation = { ok: true; waves: string[][] } | { ok: false; errors: string[] };
export function validatePlan(tasks: PlanTask[], defs: Map<string, AgentDef>, ownerName: string, policy: Policy, store?: Store, task_id?: string, done: Set<string> = new Set()): Validation {
  const errors: string[] = [], err = (m: string) => errors.push(m);
  if (!Array.isArray(tasks) || !tasks.length) return { ok: false, errors: ["the plan has no tasks"] };
  if (tasks.length > MAX_PLAN_TASKS) err(`too many tasks (${tasks.length}, limit ${MAX_PLAN_TASKS})`);
  const owner = defs.get(ownerName), ids = new Set<string>();
  for (const t of tasks) {
    if (!/^[a-z][a-z0-9_-]{0,23}$/i.test(t.id ?? "")) err(`task id "${t.id}" is not a short word (letters, digits, - or _)`);
    else if (ids.has(t.id)) err(`duplicate task id "${t.id}"`); else ids.add(t.id);
  }
  for (const t of tasks) {
    if (t.phase !== undefined && (!Number.isInteger(t.phase) || t.phase < 1 || t.phase > 20)) err(`${t.id}: phase must be a whole number from 1 to 20 (got ${JSON.stringify(t.phase)})`);
    for (const dep of t.deps ?? []) { const dt = tasks.find((x) => x.id === dep); if (dt && t.phase && dt.phase && dt.phase > t.phase) err(`${t.id} (phase ${t.phase}) depends on ${dep} (phase ${dt.phase}): a task cannot wait for a later phase`); }
    const d = defs.get(t.role);
    { const mp = modelProblem(t.role, t.model); if (mp) err(`${t.id}: ${mp}`); }
    if (!d) { err(`${t.id}: unknown role "${t.role}"`); continue; }
    if (!owner?.agents.includes(t.role)) err(`${t.id}: ${ownerName} may not call "${t.role}" (it may call: ${owner?.agents.join(", ")})`);
    for (const f of ["objective", "output", "boundaries"] as const) if (!t[f]?.trim()) err(`${t.id}: ${f} is empty`);
    if (d.writes && !t.writes?.length) err(`${t.id}: ${t.role} can write, so the task must list the files it may change (writes)`);
    if (!d.writes && t.writes?.length) err(`${t.id}: ${t.role} is read-only and cannot have writes`);
    for (const dep of t.deps ?? []) { if (dep === t.id) err(`${t.id}: depends on itself`); else if (!ids.has(dep) && !done.has(dep)) err(`${t.id}: depends on unknown task "${dep}"`); }
    const s = t.session ?? "new";
    if (s !== "new") {
      const a = store && task_id ? store.agent(task_id, s) : undefined;
      if (!a) err(`${t.id}: session "${s}" is not "new" and not an agent of this task`); else if (a.name !== t.role) err(`${t.id}: ${s} is a ${a.name}, not a ${t.role}`);
    }
  }
  // waves (Kahn); a leftover means a cycle
  const left = new Map(tasks.map((t) => [t.id, new Set((t.deps ?? []).filter((x) => ids.has(x) && x !== t.id))])), waves: string[][] = [];
  for (let guard = 0; left.size && guard <= tasks.length; guard++) {   // each pass removes at least one task or stops: it cannot run away
    const ready = [...left].filter(([, d]) => d.size === 0).map(([k]) => k);
    if (!ready.length) { err(`dependency cycle among: ${[...left.keys()].join(", ")}`); break; }
    waves.push(ready); for (const k of ready) left.delete(k); for (const d of left.values()) for (const k of ready) d.delete(k);
  }
  for (const [wi, w] of waves.entries()) {
    if (w.length > MAX_WAVE) err(`wave ${wi + 1} would run ${w.length} tasks at once (limit ${MAX_WAVE}); chain some with deps`);
    const ts = w.map((id) => tasks.find((t) => t.id === id)!);
    for (let i = 0; i < ts.length; i++) for (let j = i + 1; j < ts.length; j++) {
      const a = ts[i]!, b = ts[j]!;
      if ((a.writes ?? []).some((x) => (b.writes ?? []).some((y) => overlaps(x, y)))) err(`${a.id} and ${b.id} would write the same files at the same time; make one depend on the other`);
      if (a.role === b.role && (a.session ?? "new") === "new" && (b.session ?? "new") === "new" && similar(a.objective, b.objective)) err(`${a.id} and ${b.id} look like the same work given twice; merge them or make the objectives different`);
      if (a.session && a.session !== "new" && a.session === b.session) err(`${a.id} and ${b.id} both continue ${a.session} at the same time`);
    }
  }
  const newByRole = new Map<string, number>();
  for (const t of tasks) if ((t.session ?? "new") === "new") newByRole.set(t.role, (newByRole.get(t.role) ?? 0) + 1);
  for (const [role, n] of newByRole) { const have = store && task_id ? store.agentsOf(task_id).filter((a) => a.name === role).length : 0; if (have + n > policy.maxInstancesPerRole) err(`${n} new ${role} agents would exceed the limit of ${policy.maxInstancesPerRole} (already ${have})`); }
  return errors.length ? { ok: false, errors } : { ok: true, waves };
}

/** What a task receives from the tasks it depends on: their answers from the ledger, by reference. */
export function depsBlock(store: Store, plan: PlanRow, t: PlanTask): string {
  const lines = (t.deps ?? []).map((d) => plan.tasks.find((x) => x.id === d)).filter((x): x is NonNullable<typeof x> => !!x && x.status === "done")
    .map((x) => `- ${x.id} (${x.agent_id}): ${(store.reports.find((r) => r.id === x.report_id)?.summary ?? "").slice(0, 600).replace(/\n+/g, " ")}`);
  return lines.length ? "\n\nRESULTS FROM THE TASKS YOU DEPEND ON (from the ledger; use them, do not redo that work):\n" + lines.join("\n") : "";
}

// ------------------------------------------------------------------------------------------------ replanning (the Project Manager's tool)
export interface ReplanOk { ok: true; tasks: PlanRow["tasks"]; added: string[]; modified: string[]; cancelled: string[]; redo: string[]; stop: { task: string; agent_id: string; call_id?: string }[]; affected_agents: string[]; summary: string }
export type ReplanRes = ReplanOk | { ok: false; errors: string[] };
const sameTask = (a: PlanTask, b: PlanTask) => a.role === b.role && a.objective === b.objective && a.output === b.output && a.boundaries === b.boundaries && JSON.stringify(a.writes ?? []) === JSON.stringify(b.writes ?? []) && JSON.stringify([...(a.deps ?? [])].sort()) === JSON.stringify([...(b.deps ?? [])].sort()) && (a.phase ?? 0) === (b.phase ?? 0);

/**
 * Pure: the PM lists the tasks it WANTS from now on (new, changed, kept). Finished tasks it does not list stay as history; unfinished ones it does not list are cancelled.
 * A changed task continues the SAME agent (its context) with a "change of requirements" note; every task that used its result is redone the same way.
 * An invalid result (cycle, unknown dependency, two writers on one file...) is refused with every reason and NOTHING changes.
 */
export function replan(plan: PlanRow, wanted: PlanTask[], reason: string, defs: Map<string, AgentDef>, ownerName: string, policy: Policy, store?: Store, task_id?: string): ReplanRes {
  const old = new Map(plan.tasks.map((t) => [t.id, t])), wantIds = new Set(wanted.map((t) => t.id)), v = (plan.version ?? 1) + 1;
  const doneIds = new Set(plan.tasks.filter((t) => t.status === "done" && !wantIds.has(t.id)).map((t) => t.id));
  const prepared = wanted.map((w) => { const o = old.get(w.id); return o && o.agent_id && w.session === undefined ? { ...w, session: o.agent_id } : w; });   // a changed task continues its own agent
  const val = validatePlan(prepared, defs, ownerName, policy, store, task_id, doneIds);
  if (!val.ok) return { ok: false, errors: val.errors };
  const added: string[] = [], modified: string[] = [], cancelled: string[] = [];
  for (const w of wanted) { const o = old.get(w.id); if (!o) added.push(w.id); else if (!sameTask(o, w)) modified.push(w.id); }
  for (const o of plan.tasks) if (!wantIds.has(o.id) && o.status !== "done" && o.status !== "cancelled") cancelled.push(o.id);
  // everything that consumed the result of a changed or cancelled task must be redone
  const redo = new Set<string>(), changed = new Set([...modified, ...cancelled]);
  const finalDeps = (id: string) => (wanted.find((w) => w.id === id)?.deps ?? old.get(id)?.deps ?? []);
  for (let grew = true; grew;) {
    grew = false;
    for (const id of new Set([...old.keys(), ...wantIds])) {
      if (changed.has(id) || redo.has(id) || cancelled.includes(id)) continue;
      if (finalDeps(id).some((d) => changed.has(d) || redo.has(d))) { const st = old.get(id)?.status; if (st === "done" || st === "running") { redo.add(id); grew = true; } }
    }
  }
  const tasks: PlanRow["tasks"] = []; const stop: ReplanOk["stop"] = [];
  const noteFor = (kind: string, why: string) => `CHANGE OF REQUIREMENTS (plan v${v}): ${why}. ${kind}`;
  for (const id of new Set([...plan.tasks.map((t) => t.id), ...wantIds])) {
    const o = old.get(id), w = wanted.find((x) => x.id === id);
    if (!w) { // not listed
      if (!o) continue;
      if (cancelled.includes(id)) { if (o.status === "running") stop.push({ task: id, agent_id: o.agent_id!, call_id: o.call_id }); tasks.push({ ...o, status: "cancelled", error: `cancelled by the plan change (v${v}): ${reason}` }); }
      else if (redo.has(id)) { if (o.status === "running") stop.push({ task: id, agent_id: o.agent_id!, call_id: o.call_id }); tasks.push({ ...o, status: "pending", session: o.agent_id, note: noteFor("An input to your task changed, so redo your task with it.", reason), error: undefined, call_id: undefined, report_id: undefined }); }
      else tasks.push(o);
      continue;
    }
    if (!o) { tasks.push({ ...w, status: "pending" }); continue; }
    if (modified.includes(id) || redo.has(id)) {
      if (o.status === "running") stop.push({ task: id, agent_id: o.agent_id!, call_id: o.call_id });
      tasks.push({ ...o, ...w, session: w.session ?? o.agent_id, status: "pending", note: noteFor(modified.includes(id) ? "Your own task was changed; continue with the new version." : "An input to your task changed, so redo your task with it.", reason), error: undefined, call_id: undefined, report_id: undefined });
    } else tasks.push({ ...o });
  }
  const affected = [...new Set(tasks.filter((t) => t.agent_id && (modified.includes(t.id) || redo.has(t.id) || cancelled.includes(t.id))).map((t) => t.agent_id!))];
  const summary = `v${v}: ${added.length} added, ${modified.length} changed, ${cancelled.length} cancelled, ${redo.size} redone because their inputs changed`;
  return { ok: true, tasks, added, modified, cancelled, redo: [...redo], stop, affected_agents: affected, summary };
}
