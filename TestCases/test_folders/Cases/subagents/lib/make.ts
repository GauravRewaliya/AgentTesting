import type { Case } from "@core/types.ts";

// Shared by every sub-agent suite (Cases/subagents/<agent>/main.ts). Here the SUB-AGENT is what is tested, not the lead.
// The lead is a pass-through: it hands the task to the named agent word for word and returns the answer unchanged, so what the judge reads
// is the sub-agent's work (files left in run_test, its report, its blocker line). Every case runs the REAL sub-agent (a real call costs credits),
// so it declares `allow_real_subAg: true` (rule c in the project CLAUDE.md), is one short turn, and is capped (`max_cost_usd`).
// Never run these routinely: by case id, on purpose (`bun testrun/run.ts <agent suite> <case id>`; `--list` / `--fake` are free).
// This folder has no main.ts, so it is not a suite.

export interface SubSpec {
  id: string;
  /** what the sub-agent must show in this case (one line) */
  title: string;
  /** files in run_test/ before the lead starts (path relative to run_test) */
  seed?: Record<string, string>;
  /** the task, exactly as the sub-agent must receive it */
  task: string;
  /** what a person / judge checks: files, report shape, boundaries. Nothing here is asserted by code. */
  must: string;
  /** USD cap for this case (default 0.5) */
  cap?: number;
}

export const subCase = (agent: string, s: SubSpec): Case => ({
  id: s.id,
  title: `[sub:${agent}] ${s.title}`,
  agents: [agent],
  max_agent_calls: 1,
  allow_real_subAg: true as const,
  max_cost_usd: s.cap ?? 0.5,
  ...(s.seed ? { seed: s.seed } : {}),
  turns: [{
    user: `Call the ${agent} sub-agent once and give it exactly this task, word for word, adding nothing:\n"""\n${s.task}\n"""\nThen show me its answer unchanged (a blocker line included).`,
    allowed: [agent],
    expected: { context: `The ${agent} sub-agent is called ONCE with the task above; the lead adds nothing and does not do the work itself. ${s.must}`, expected_agents_res: [], expected_roles: [agent] },   // expected_roles: the agent is called at least once (the call is real, so no recorded result id)
  }],
});
