// PHASE GATES IN CODE (n+1 waits for n). A plan task may carry `phase` (1, 2, 3 ...). The scheduler starts a task of phase N only when
//   (1) every task of every earlier phase is done (or cancelled), and
//   (2) every earlier phase has a recorded GATE: `phase_pass` (the exit check evidence), refused while a task of the phase is open.
// A prompt rule can be forgotten by a small model; this cannot. Tasks without a phase are not gated. Pure functions: tested offline (self_test/power.ts).
import type { PlanRow } from "./plan.ts";

export type PlanTaskRow = PlanRow["tasks"][number];
export interface Gate { t: number; by: string; evidence: string }
export const MAX_PHASE = 20;
const closed = (t: PlanTaskRow) => t.status === "done" || t.status === "cancelled";
const phases = (p: PlanRow) => [...new Set(p.tasks.map((t) => t.phase).filter((n): n is number => typeof n === "number"))].sort((a, b) => a - b);

/** Why a pending task of this plan may not start yet because of phases; null = no phase reason. `dead` = it can never start (an earlier phase failed). */
export function gateBlock(p: PlanRow, t: { phase?: number }): { reason: string; dead: boolean } | null {
  if (!t.phase) return null;
  for (const n of phases(p).filter((x) => x < t.phase!)) {
    const open = p.tasks.filter((x) => x.phase === n && !closed(x));
    const dead = open.find((x) => x.status === "failed" || x.status === "skipped");
    if (dead) return { reason: `phase ${n} did not finish (${dead.id} ${dead.status})`, dead: true };
    if (open.length) return { reason: `phase ${n} is not finished (${open.map((x) => x.id).join(", ")})`, dead: false };
    if (!p.gates?.[n]) return { reason: `phase ${n} is finished but its gate is not passed (run phase_pass --plan ${p.plan_id} --phase ${n} --evidence "<exit check result>")`, dead: false };
  }
  return null;
}

export type PassRes = { ok: true; already?: boolean; phase: number } | { ok: false; errors: string[] };
/** Pass the gate of phase `n`. Needs evidence, at least one done task, no open task, and the earlier gates. */
export function passPhase(p: PlanRow, n: number, by: string, evidence: string): PassRes {
  const errors: string[] = [], mine = p.tasks.filter((t) => t.phase === n);
  if (!mine.length) return { ok: false, errors: [`the plan has no task in phase ${n} (phases: ${phases(p).join(", ") || "none"})`] };
  if (p.gates?.[n]) return { ok: true, already: true, phase: n };
  const open = mine.filter((t) => !closed(t));
  if (open.length) errors.push(`phase ${n} still has open tasks: ${open.map((t) => `${t.id} (${t.status})`).join(", ")}`);
  if (!mine.some((t) => t.status === "done")) errors.push(`phase ${n} has no finished task`);
  for (const q of phases(p).filter((x) => x < n)) if (!p.gates?.[q]) errors.push(`phase ${q} has not passed its gate yet`);
  if ((evidence ?? "").trim().length < 8) errors.push(`--evidence is required: say which exit checks you ran and what they showed (at least 8 characters)`);
  if (errors.length) return { ok: false, errors };
  (p.gates ??= {})[n] = { t: Date.now(), by, evidence: evidence.trim().slice(0, 400) };
  return { ok: true, phase: n };
}

/** After a replan: a passed gate that has open work at or below it is not true any more. Returns the phases that were reopened. */
export function reopenGates(p: PlanRow): number[] {
  const out: number[] = [];
  for (const k of Object.keys(p.gates ?? {}).map(Number)) if (p.tasks.some((t) => typeof t.phase === "number" && t.phase <= k && !closed(t))) { delete p.gates![k]; out.push(k); }
  return out;
}

export type PhaseState = "waiting" | "building" | "ready_for_gate" | "passed" | "failed";
export interface PhaseRow { phase: number; state: PhaseState; done: number; total: number; tasks: { id: string; status: string }[]; gate?: Gate; blocked_by?: string }
export function phaseRows(p: PlanRow): PhaseRow[] {
  return phases(p).map((n) => {
    const ts = p.tasks.filter((t) => t.phase === n), done = ts.filter((t) => t.status === "done").length, gate = p.gates?.[n];
    const failed = ts.some((t) => t.status === "failed" || t.status === "skipped");
    const first = ts.find((t) => t.status === "pending"), blocked = first ? gateBlock(p, first)?.reason : undefined;
    const state: PhaseState = gate ? "passed" : failed ? "failed" : ts.every(closed) && done ? "ready_for_gate" : ts.some((t) => t.status === "running" || t.status === "done" || t.status === "blocked") || (ts.some((t) => t.status === "pending") && !blocked) ? "building" : "waiting";
    return { phase: n, state, done, total: ts.length, tasks: ts.map((t) => ({ id: t.id, status: t.status })), gate, blocked_by: blocked };
  });
}
export const phaseText = (p: PlanRow): string => phaseRows(p).map((r) => `  phase ${r.phase} ${r.state.padEnd(14)} ${r.done}/${r.total} done${r.gate ? ` (gate passed: ${r.gate.evidence.slice(0, 60)})` : ""}${r.blocked_by ? ` [${r.blocked_by.slice(0, 70)}]` : ""}`).join("\n");
