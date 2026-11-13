// Free check for a PHASES.md the planner wrote: phases must be ordered. `bun test_harness/core/check_phases.ts docs/planning/<project>/PHASES.md`
// Format per phase:  "## Phase N: <name>" then a line "- **Status:** planned|building|passed", plus "- **Goal:**" and "- **Exit check:**".
// Rule (n+1 waits): a phase may be `building` or `passed` only when EVERY earlier phase is `passed`; at most one phase is `building`.
import { readFileSync } from "node:fs";

const file = process.argv[2];
if (!file) { console.error("usage: check_phases.ts <PHASES.md>"); process.exit(2); }
const text = readFileSync(file, "utf8");
const parts = text.split(/^## Phase (\d+)[:\s]/m);   // [pre, n, body, n, body, ...]
const phases: { n: number; status: string; body: string }[] = [];
for (let i = 1; i < parts.length; i += 2) {
  const body = parts[i + 1] ?? "";
  phases.push({ n: Number(parts[i]), status: (/\*\*Status:\*\*\s*(\w+)/i.exec(body)?.[1] ?? "").toLowerCase(), body });
}
const bad: string[] = [];
if (!phases.length) bad.push("no '## Phase N: name' blocks found");
phases.forEach((p, i) => {
  if (!["planned", "building", "passed"].includes(p.status)) bad.push(`phase ${p.n}: Status must be planned|building|passed (got '${p.status}')`);
  if (!/\*\*Goal:\*\*/i.test(p.body)) bad.push(`phase ${p.n}: no **Goal:**`);
  if (!/\*\*Exit check:\*\*/i.test(p.body)) bad.push(`phase ${p.n}: no **Exit check:**`);
  if (i > 0 && p.n !== phases[i - 1]!.n + 1) bad.push(`phase ${p.n}: numbers must go 1,2,3... in order`);
  if ((p.status === "building" || p.status === "passed") && phases.slice(0, i).some((q) => q.status !== "passed")) bad.push(`phase ${p.n} is ${p.status} but an earlier phase has not passed (n+1 waits for n)`);
});
if (phases.filter((p) => p.status === "building").length > 1) bad.push("more than one phase is 'building'");
if (bad.length) { console.error(bad.join("\n")); process.exit(1); }
console.log(`phases ok (${phases.map((p) => `${p.n}:${p.status}`).join(" ")})`);
