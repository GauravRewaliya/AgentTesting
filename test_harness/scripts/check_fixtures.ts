// Free check of the fixtures AND of every case declaration (no model calls). Exits 1 on any problem.   `bun test_harness/scripts/check_fixtures.ts`
// USED BY: you, before and after editing cases (project CLAUDE.md "Fixtures are compulsory"). Library part: test_harness/core/fixtures.ts.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { FIXTURES, suiteDirs } from "../core/paths.ts";
import { FIXTURE_DIR, expectedFixtureIds, missingFixtures, recordedIds, recordedSuites, type FixtureCase } from "../core/fixtures.ts";

{
  const have = recordedIds(); let bad = 0, flagged = 0, ok = 0, none = 0, broken = 0;
  for (const d of suiteDirs()) {   // { name, main } of every suite (Cases/ and Cases/subagents/)
    const f = d.main;
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
  const { validate, loadAll } = await import("./validate_cases.ts");   // strict shape check of every case (TestCases/types.ts)
  const problems = validate(await loadAll(), have, recordedSuites());
  const { buildRows, indexText } = await import("./build_index.ts");   // index.json is maintained: it must equal what build_index.ts writes now
  const cur = existsSync(join(FIXTURES, "index.json")) ? readFileSync(join(FIXTURES, "index.json"), "utf8") : "";
  if (cur !== indexText(await buildRows())) problems.push({ suite: "agent_fixture", case: "index.json", what: "is stale: run `bun test_harness/scripts/build_index.ts`" });
  for (const p of problems) console.log(`INVALID ${p.suite} / ${p.case}: ${p.what}`);
  if (problems.length) console.log(`${problems.length} case declaration problem(s)`);
  process.exit(bad || broken || problems.length ? 1 : 0);
}
