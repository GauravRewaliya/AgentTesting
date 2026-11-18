// ALL fixture logic in one file: where the recorded results are (resultFiles), which ids exist (recordedIds / recordedSuites), and the policy (warnMissingFixtures).
// USED BY: the runners (warnMissingFixtures), harness_own_custom/main.ts (resultFiles), scripts/check_fixtures.ts, scripts/build_index.ts, scripts/validate_cases.ts.
//   ONE location : TestCases/test_folders/agent_fixture (FIXTURES in paths.ts). Nothing else may hold recorded results; every reader goes through FIXTURES.
//   A case that expects a recorded result (an id in expected_agents_res, not a `session:` follow-up) which does not exist there:
//       - prints a WARNING on the logger that recommends recording it in that folder,
//       - unless the case says `allow_real_subAg: true` (explicit "I run without a fixture"): then it is silent. Nothing throws at run time.
//   The scan over EVERY suite (exit 1 if a case is missing a fixture and has not said allow_real_subAg) is a script: `bun test_harness/scripts/check_fixtures.ts`.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { FIXTURES, RESULTS, ROOT } from "./paths.ts";

/** Recorded results are NESTED by suite: agent_fixture/results/<suite folder name>/<file>.ts (same names as TestCases/test_folders/Cases/<suite>). */
export const resultFiles = (dir = RESULTS): { suite: string; file: string; path: string }[] =>
  !existsSync(dir) ? [] : readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).flatMap((d) =>
    readdirSync(join(dir, d.name)).filter((f) => f.endsWith(".ts")).sort().map((f) => ({ suite: d.name, file: f, path: join(dir, d.name, f) })));

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
