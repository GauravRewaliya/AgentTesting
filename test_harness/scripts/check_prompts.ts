// Free (no model): the exact size of every agent prompt and chapter, and a warning for each one over the limit (8000 characters, 200 lines).
//   bun test_harness/scripts/check_prompts.ts            table + warnings, exit 0
//   bun test_harness/scripts/check_prompts.ts --strict   exit 1 when anything is over (CI / before a commit)
// The same warnings are printed when the dashboard server starts (test_harness/ui/server/index.ts).
import { PROMPT_LIMIT, emphasisWarnings, promptSizes, promptWarnings } from "../core/agents/prompt_sizes.ts";
import { SUITES, allPromptCases } from "../../TestCases/test_folders/prompt_test/index.ts";
import { isTag } from "../../TestCases/tags.ts";
import { agentExists } from "../core/agents/index.ts";
import { launchSizes } from "../core/launch_sizes.ts";

const rows = promptSizes();
console.log(`${"agent".padEnd(24)}${"what".padEnd(26)}${"chars".padStart(7)}${"lines".padStart(7)}   (limit ${PROMPT_LIMIT} chars)`);
for (const r of rows) console.log(`${(r.set === "test" ? "~" : "") + r.agent}`.padEnd(24) + `${r.kind === "prompt" ? "prompt " + r.file : r.file}`.padEnd(26) + String(r.chars).padStart(7) + String(r.lines).padStart(7) + (r.over ? "   OVER" : ""));
const w = promptWarnings(), shout = emphasisWarnings();
for (const x of w) console.log("WARNING " + x);
for (const x of shout) console.log("advice  " + x);
console.log(w.length ? `\n${w.length} over the limit` : "\nall prompts and chapters are within the limit");

// what the model REALLY gets: the CLAUDE.md plus the team-tool documentation the harness appends at launch (the lead: its call syntax and the agent declarations too)
console.log(`\n${"agent".padEnd(14)}${"file".padStart(8)}${"launch".padStart(9)}${"~tokens".padStart(9)}   (the launch prompt is what is sent every turn)`);
for (const r of await launchSizes()) console.log(`${r.agent.padEnd(14)}${String(r.staticChars).padStart(8)}${String(r.launchChars).padStart(9)}${String(Math.round(r.launchChars / 4)).padStart(9)}${r.launchChars > PROMPT_LIMIT * 1.5 ? "   big" : ""}`);

// the PROMPT TESTS (flag prompt_testing, TestCases/test_folders/prompt_test): shape only, free. Run by `bun test_harness/scripts/prompt_test.ts <suite|agent>`.
const bad: string[] = [], ids = new Set<string>(), cases = allPromptCases();
for (const s of SUITES) {
  const seen = new Set<string>();
  for (const c of s.cases) {
    const at = `${s.name}/${c.id}`;
    if (c.agent !== s.agent) bad.push(`${at}: agent is "${c.agent}", but the suite tests ${s.agent}`);
    if (!agentExists(c.agent)) bad.push(`${at}: no agent "${c.agent}"`);
    if (c.flag !== "prompt_testing") bad.push(`${at}: flag must be "prompt_testing"`);
    if (ids.has(c.id)) bad.push(`${at}: id used in two places`); ids.add(c.id);
    if (c.after && !seen.has(c.after)) bad.push(`${at}: after "${c.after}" must be an EARLIER case of the same suite`);
    for (const t of c.tags ?? []) if (!isTag(t)) bad.push(`${at}: unknown tag "${t}" (TestCases/tags.ts)`);
    if (!c.about?.trim() || !c.user_message?.trim()) bad.push(`${at}: about and user_message are required`);
    const e = c.expect ?? {}, has = !!(e.calls?.length || e.not_calls?.length || e.no_calls || e.same_turn || e.first_call || e.disjoint_writes || e.any_of?.length || e.text_has?.length || e.text_not?.length);
    if (!has) bad.push(`${at}: expect states nothing to check`);
    for (const r of [...(e.text_has ?? []), ...(e.text_not ?? [])]) { try { new RegExp(r, "im"); } catch { bad.push(`${at}: bad regex /${r}/`); } }
    seen.add(c.id);
  }
}
const kids = new Map<string, number>(); for (const c of cases) if (c.after) kids.set(c.after, (kids.get(c.after) ?? 0) + 1);
const branches = [...kids.values()].filter((n) => n > 1).length, tagged = (t: string) => cases.filter((c) => (c.tags as string[] | undefined)?.includes(t)).length;
console.log(`\nprompt tests: ${cases.length} cases in ${SUITES.length} suites (${cases.filter((c) => c.after).length} chained, ${branches} branch points; tags: cost ${tagged("cost")}, loop ${tagged("loop")}, split_task ${tagged("split_task")})` + (bad.length ? `, ${bad.length} problem(s)` : ", all well-formed"));
for (const x of bad) console.log("PROBLEM " + x);
process.exit((w.length || bad.length) && process.argv.includes("--strict") ? 1 : bad.length ? 1 : 0);
