// bun core/build_index.ts  -> TestCases/test_folders/agent_fixture/index.json : find a recorded result (and what it copies) without opening it.
// Results are nested by suite (results/<suite>/<file>.ts); each row says which suite owns it. `bun core/fixture_policy.ts` fails when this file is stale.
import { readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import type { IndexRow, ResultModule } from "./types.ts";
import { FIXTURES, resultFiles } from "./paths.ts";

/** The rows as they must be written now (also used by fixture_policy to detect a stale index.json). */
export async function buildRows(): Promise<IndexRow[]> {
  const rows: IndexRow[] = [];
  for (const { suite, path } of resultFiles()) {
    const m = (await import(path)).default as ResultModule;
    const copies = [...readFileSync(path, "utf8").matchAll(/req\.cp\("([^"]+)"/g)].map((x) => "store/" + x[1]);
    rows.push({ id: m.id, suite, file: relative(FIXTURES, path), title: m.title, agent: m.match?.agent, keywords: m.match?.keywords, text: m.expected_input.text, ...(copies.length ? { copies } : {}) });
  }
  return rows;
}
export const indexText = (rows: IndexRow[]) => JSON.stringify(rows, null, 1) + "\n";

if (import.meta.main) {
  const rows = await buildRows();
  writeFileSync(join(FIXTURES, "index.json"), indexText(rows));
  console.log(rows.length, "results indexed");
}
