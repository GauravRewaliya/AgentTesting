// Strict runtime check of EVERY suite against the declarations in ./types.ts, ./tags.ts and agent_fixture/types.ts.
// `bun TestCases/validate.ts`, and run by `bun test_harness/core/fixture_policy.ts`. Exit 1 on any problem.
import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { isTag } from "./tags.ts";
import { branchWarnings, normalizeBranches } from "./branch.ts";
import type { Case } from "./types.ts";
import { check as capCheck } from "../test_harness/core/orchistraitor/harness_own_custom/capabilities.ts";

const ROOT = resolve(import.meta.dir, "..");
export const SUITES = join(ROOT, "TestCases/test_folders");
const FIXTURES = join(SUITES, "agent_fixture");
const AGENT_DEFS = join(ROOT, "test_harness/core/helper/agents");
const PROMPTS = [join(ROOT, "test_harness/core/orchistraitor/harness_own_custom/core/prompts"), join(FIXTURES, "store/legacy/prompts")];
const SESSION = /^session:[^#]+#\d+$/;
export interface Problem { suite: string; case: string; what: string }

/** Every suite folder (a folder with main.ts) with its cases and suite-level tags. */
export async function loadAll(): Promise<{ suite: string; cases: Case[]; tags: unknown }[]> {
  const out = [];
  for (const d of readdirSync(SUITES, { withFileTypes: true }).filter((x) => x.isDirectory())) {
    const f = join(SUITES, d.name, "main.ts"); if (!existsSync(f)) continue;
    const m = await import(pathToFileURL(f).href); out.push({ suite: d.name, cases: m.cases as Case[], tags: m.tags });
  }
  const flat = normalizeBranches(out.flatMap((s) => s.cases.map((c) => ({ ...c, suite: s.suite }))));
  for (const s of out) s.cases = flat.filter((c) => c.suite === s.suite) as Case[];
  return out;
}

export function validate(all: { suite: string; cases: Case[]; tags: unknown }[], recorded: Set<string> | Map<string, string>): Problem[] {
  const allIds = new Set(all.flatMap((x) => x.cases.map((c) => c.id))), bad: Problem[] = [], seen = new Map<string, string>();
  const agentOk = (a: string) => existsSync(join(AGENT_DEFS, a + ".ts"));
  for (const { suite, cases, tags } of all) {
    const add = (c: string, what: string) => bad.push({ suite, case: c, what });
    if (tags !== undefined && (!Array.isArray(tags) || !tags.every((t) => typeof t === "string" && isTag(t)))) add("(suite)", `suite tags must come from tags.ts: ${JSON.stringify(tags)}`);
    for (const c of cases) {
      const id = String(c.id), a = (w: string) => add(id, w);
      if (!/^[a-z0-9][a-z0-9_]*$/i.test(id)) a(`id "${id}" must be letters, digits, underscore`);
      if (seen.has(id)) a(`duplicate id (also in ${seen.get(id)})`); else seen.set(id, suite);
      if (!c.title?.trim()) a("title (the case name) is empty");
      for (const t of c.tags ?? []) if (!isTag(t)) a(`unknown tag "${t}" (see tags.ts)`);
      if (!c.turns?.length) a("no turns");
      if (c.after && !allIds.has(c.after)) a(`after "${c.after}" is not a case`);
      if (c.after && c.after === id) a("after points at itself");
      for (const g of [...c.agents, ...(c.distractors ?? [])]) if (!agentOk(g)) a(`agent "${g}" has no definition in core/helper/agents/${g}.ts`);
      if (new Set(c.agents).size !== c.agents.length) a("agents has duplicates");
      for (const d of c.distractors ?? []) if (c.agents.includes(d)) a(`"${d}" is both an agent and a distractor`);
      if (c.guard && !existsSync(join(FIXTURES, "store", c.guard))) a(`guard file missing: agent_fixture/store/${c.guard}`);
      if (c.lead && !PROMPTS.some((d) => existsSync(join(d, c.lead + ".md")))) a(`lead prompt missing: ${c.lead}.md`);
      if (c.max_agent_calls !== undefined && !(Number.isInteger(c.max_agent_calls) && c.max_agent_calls >= 1)) a("max_agent_calls must be an integer >= 1");
      if (c.router === false && c.agents.length && !c.tools?.includes("Agent")) a("router:false with agents but no Agent tool");
      for (const n of c.needs ?? []) if (capCheck([n]).warnings.some((w) => /unknown/i.test(w))) a(`needs "${n}" is not in capabilities.ts`);
      const refs = c.turns.flatMap((t) => t.expected.expected_agents_res), recs = refs.filter((r) => !r.startsWith("session:"));
      for (const r of recs) { const at = recorded instanceof Map ? recorded.get(r) : undefined; if (at && at !== suite) a(`result "${r}" is filed under results/${at}/ but this case is in ${suite}: move it to results/${suite}/`); }
      for (const r of refs) if (r.startsWith("session:") && !SESSION.test(r)) a(`bad follow-up ref "${r}" (session:<agent>#<n>)`);
      if (c.allow_real_subAg) { if (recs.length && recs.every((r) => recorded.has(r))) a("allow_real_subAg:true but every expected result IS recorded: drop allow_real_subAg"); }
      else if (!recs.length && !refs.length) a("expects no sub-agent but is not marked allow_real_subAg:true");
      for (const t of c.turns) {
        if (!t.user?.trim()) a("a turn has an empty user message");
        if (!t.expected?.context?.trim()) a("a turn has an empty expected.context");
        for (const al of t.allowed ?? []) if (![...c.agents, ...(c.distractors ?? [])].includes(al)) a(`allowed "${al}" is not one of the case's agents`);
      }
    }
  }
  return bad;
}

if (import.meta.main) {
  const { recordedSuites } = await import("../test_harness/core/fixture_policy.ts");
  const all = await loadAll(), bad = validate(all, recordedSuites());
  for (const w of branchWarnings(all.flatMap((s) => s.cases.map((c) => ({ ...c, suite: s.suite }))))) console.log("WARNING " + w);
  for (const p of bad) console.log(`${p.suite} / ${p.case}: ${p.what}`);
  console.log(bad.length ? `\n${bad.length} problem(s)` : "ok: every case matches TestCases/types.ts");
  process.exit(bad.length ? 1 : 0);
}
