// Pure pipeline logic (plan section 7 / 20): which stages run, and what happens after a review. Replaces model/stages.ts + route.ts.
import type { Finding, Pipeline } from "./types.ts";

export interface StageCtx { tier: number; hasFindings: boolean }
export function stageActive(when: string | undefined, ctx: StageCtx): boolean {
  if (!when || when === "always") return true;
  if (when === "findings") return ctx.hasFindings;
  const m = when.match(/^tier>=(\d)$/);
  if (m) return ctx.tier >= Number(m[1]);
  throw new Error(`unknown pipeline condition: ${when}`);
}
/** Round 1 follows the pipeline's `when`s; later rounds follow `on_issue` (a reviewer issue goes to the planner, then the builder). */
export function stagesFor(p: Pipeline, round: number, ctx: StageCtx): string[] {
  if (round > 1) return [p.on_issue.to, p.on_issue.then, p.on_issue.from];
  return p.stages.filter((s) => stageActive(s.when, ctx)).map((s) => s.role);
}

export interface Outcome { pass: boolean; checksOk: boolean; open: Finding[]; stuck: Finding[]; round: number; maxRounds: number }
export type Decision = { kind: "done" } | { kind: "again" } | { kind: "person"; reason: string };

/** "Satisfied" is decided here, not by the model's opinion alone. */
export function decide(o: Outcome): Decision {
  const blockers = o.open.filter((f) => f.triage === "needs_person" || f.triage === "conflicts_with_request");
  if (blockers.length) return { kind: "person", reason: `${blockers[0]!.triage}: ${blockers[0]!.text}` };
  if (o.pass && o.checksOk && o.open.length === 0) return { kind: "done" };
  if (o.stuck.length) return { kind: "person", reason: `stuck: the same finding came back (${o.stuck[0]!.id})` };
  if (o.round >= o.maxRounds) return { kind: "person", reason: `max_rounds (${o.maxRounds})` };
  return { kind: "again" };
}
