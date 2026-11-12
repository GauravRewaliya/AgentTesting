// Role-order guard (ported from Test_agent_2 guard.py). PURE: decides whether a sub-agent call may proceed.
// Rules come from a JSON file per case (TestCases/test_folders/agent_fixture/store/*_rules.json): { <role>: { requires_done[], contains_all[], min_chars, forbidden? } }.
// The mod calls it through `bun main.ts guard <agent>`; tests call it directly (test/harness.test.ts).
import type { Rule } from "../../../../../TestCases/test_folders/agent_fixture/types.ts";
export type { Rule };   // declared in agent_fixture/types.ts
export type GuardInput = { rules: Record<string, Rule>; agent: string; prompt: string; done: string[]; allowed?: string[] | null };

/** Reasons the call must be stopped; empty = it may proceed. */
export function checkHandover(i: GuardInput): string[] {
  const r = i.rules[i.agent]; const why: string[] = [];
  if (!r) return [`unknown role '${i.agent}'`];
  const low = i.prompt.toLowerCase();
  if (r.forbidden) why.push(`'${i.agent}' is a useless/forbidden role for these cases`);
  if (i.allowed && !i.allowed.includes(i.agent)) why.push(`'${i.agent}' not allowed in this turn (allowed: ${i.allowed.join(", ") || "none"})`);
  for (const d of r.requires_done ?? []) if (!i.done.includes(d)) why.push(`needs '${d}' done first`);
  for (const k of r.contains_all ?? []) if (!low.includes(k.toLowerCase())) why.push(`hand-over lacks '${k}'`);
  if (i.prompt.length < (r.min_chars ?? 0)) why.push(`hand-over too thin (${i.prompt.length} < ${r.min_chars} chars)`);
  return why;
}
