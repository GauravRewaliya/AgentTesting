// The fixture policy, in one place.
//   ONE location : TestCases/test_folders/agent_fixture (FIXTURES in paths.ts). Nothing else may hold recorded results; every reader goes through FIXTURES.
//   A case that expects a recorded result (an id in expected_agents_res, not a `session:` follow-up) which does not exist there:
//       - prints a WARNING on the logger that recommends recording it in that folder,
//       - unless the case says `allow_real_subAg: true` (explicit "I run without a fixture"): then it is silent. Nothing throws at run time.
//   `bun core/fixture_policy.ts` scans EVERY suite and exits 1 if any case is missing a fixture and has not said allow_real_subAg, so none is missed.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { CASES, FIXTURES, ROOT, resultFiles } from "./paths.ts";

/** What the policy needs from a case (the shared Case type and the f1 RawCase both fit). */
export interface FixtureCase { id: string; allow_real_subAg?: boolean; turns: { expected: { expected_agents_res: string[] } }[] }
export type FixtureLog = (message: string) => void;

export const FIXTURE_DIR = relative(ROOT, FIXTURES);   // TestCases/test_folders/agent_fixture

/** Ids of every recorded result, read from the result files themselves (never stale like index.json). */
export function recordedIds(): Set<string> { return new Set(recordedSuites().keys()); }
/** id -> suite folder it is filed under (results/<suite>/<file>.ts). */
export function recordedSuites(): Map<string, string> {
  const m = new Map<string, string>();
  for (const { suite, path } of resultFiles()) { const id = readFileSync(path, "utf8").match(/\bid:\s*"([^"]+)"/)?.[1]; if (id) m.set(id, suite); }
  return m;
}
/** The recorded-result ids a case expects (follow-ups `session:<agent>#n` are not fixtures). */
export const expectedFixtureIds = (c: FixtureCase): string[] => [...new Set(c.turns.flatMap((t) => t.expected.expected_agents_res).filter((e) => !e.startsWith("session:")))];
export const missingFixtures = (c: FixtureCase, have: Set<string> = recordedIds()): string[] => expectedFixtureIds(c).filter((id) => !have.has(id));

/** Warn (on `log`) when a case lacks fixtures and has not opted out. Returns the missing ids either way. */
export function warnMissingFixtures(c: FixtureCase, log: FixtureLog = (m) => console.warn(m), have?: Set<string>): string[] {
  const missing = missingFixtures(c, have);
  if (missing.length && !c.allow_real_subAg) log(`   WARNING fixture: case ${c.id} expects recorded result(s) that do not exist: ${missing.join(", ")}. Recommended: record them in ${FIXTURE_DIR}/results (see ${FIXTURE_DIR}/README.md), or set \`allow_real_subAg: true\` on the case to run without a fixture.`);
  return missing;
}

if (import.meta.main) {
  const have = recordedIds(); let bad = 0, flagged = 0, ok = 0, none = 0, broken = 0;
  for (const d of readdirSync(CASES, { withFileTypes: true }).filter((x) => x.isDirectory())) {
    const f = join(CASES, d.name, "main.ts"); if (!existsSync(f)) continue;
    let cases: FixtureCase[];
    try { cases = (await import(pathToFileURL(f).href)).cases as FixtureCase[]; }
    catch (e) { broken++; console.log(`${d.name.padEnd(26)} FAILED TO LOAD: ${String((e as Error).message).split("\n").slice(0, 2).join(" | ")}`); continue; }   // one broken suite must not hide the others
    const lines: string[] = [];
    for (const c of cases) {
      const exp = expectedFixtureIds(c), miss = missingFixtures(c, have);
      if (c.allow_real_subAg) flagged++;   // explicit opt-out (real sub-agents, lead alone, or "must NOT call a sub-agent")
      else if (!exp.length && c.turns.every((t) => t.expected.expected_agents_res.some((e) => e.startsWith("session:")))) none++;   // pure session follow-ups: answered from the earlier fixture session
      else if (!exp.length) { bad++; lines.push(`    ${c.id}: no recorded result expected and no allow_real_subAg: true (declare which one it is)`); }
      else if (!miss.length) ok++;
      else { bad++; lines.push(`    ${c.id}: missing ${miss.join(", ")}`); }
    }
    console.log(`${d.name.padEnd(26)} ${String(cases.length).padStart(3)} cases${lines.length ? `, ${lines.length} without fixture and without allow_real_subAg:` : ""}`);
    for (const l of lines) console.log(l);
  }
  console.log(`\n${ok} with fixtures, ${none} session follow-ups (served from history), ${flagged} explicit allow_real_subAg, ${bad} MISSING, ${broken} suite(s) failed to load (a missing fixture warns at run time: record it in ${FIXTURE_DIR}/results or set allow_real_subAg: true)`);
  const { validate, loadAll } = await import("../../TestCases/validate.ts");   // strict shape check of every case (TestCases/types.ts)
  const problems = validate(await loadAll(), have, recordedSuites());
  const { buildRows, indexText } = await import("./build_index.ts");   // index.json is maintained: it must equal what build_index.ts writes now
  const cur = existsSync(join(FIXTURES, "index.json")) ? readFileSync(join(FIXTURES, "index.json"), "utf8") : "";
  if (cur !== indexText(await buildRows())) problems.push({ suite: "agent_fixture", case: "index.json", what: "is stale: run `bun test_harness/core/build_index.ts`" });
  for (const p of problems) console.log(`INVALID ${p.suite} / ${p.case}: ${p.what}`);
  if (problems.length) console.log(`${problems.length} case declaration problem(s)`);
  process.exit(bad || broken || problems.length ? 1 : 0);
}
