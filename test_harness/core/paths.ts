// The one place that knows where things live (folders, suite routing, run-data pointer). Import it as "@core/paths.ts".
// Anything only ONE file needs lives in that file, not here (e.g. diskSuites -> scripts/validate_cases.ts, resultFiles -> core/fixtures.ts).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CONFIG } from "./config.ts";
import { allSuites } from "../../TestCases/test_folders/Cases/index.ts";

export const ROOT = join(import.meta.dir, "../..");            // agent_testing
const CASES = join(ROOT, "TestCases", "test_folders");          // test_folders/: Cases/ (the suites), agent_fixture/ (mocks), README.md, TODO.md
/** Where all suites live: test_folders/Cases/. */
export const SUITES = join(CASES, "Cases");
export interface SuiteDir { name: string; dir: string; main: string; /** "cases" = routed by Cases/index.ts itself, else the group folder ("core_testing") */ group: string; about: string; /** case id prefixes of this suite */ ids: string[] }
/**
 * EVERY suite, as ROUTED by the index files: Cases/index.ts mounts Cases/<group>/index.ts, each lists its suites (name, about, ids, main).
 * The suite NAME is the folder name (the CLI argument, `agent_fixture/results/<name>/`, the UI), unique across all groups: a clash throws.
 * A suite that is not routed is not run; `validate_cases.ts` compares the routes with the disk (`diskSuites()`). The ONE list: nobody else lists suites.
 */
export const suiteDirs = (): SuiteDir[] => {
  const out: SuiteDir[] = [];
  for (const s of allSuites()) {
    const clash = out.find((x) => x.name === s.name);
    if (clash) throw new Error(`suite name "${s.name}" is routed twice: ${clash.dir} and ${s.dir} (suite names are folder names and must be unique)`);
    out.push({ name: s.name, dir: s.dir, main: s.file, group: s.group, about: s.about, ids: s.ids });
  }
  return out;
};
export const HARNESS = join(ROOT, "test_harness");
// ALL run data lives in ONE place: test_harness/.state/<STATE_VERSION>/ (nothing else stores results; the old .state/ is gone).
//   .state/<version>/current_pointer.json   {"current_workspace":"01"}
//   .state/<version>/index.json             session_id -> folder (see orchistraitor/harness_own_custom/runner/state/store.ts)
//   .state/<version>/data/<workspace>/      workspace.json, last/, cache/, runs/, sessions/<task>/ (session.json, events.jsonl, run/, workspace/, children/)
// STATE_VERSION default = CONFIG.stateVersion (test_harness/core/config.ts), env STATE_VERSION overrides one run. A new version starts fresh (empty), the old one stays on disk untouched.
export const STATE_VERSION: string = process.env.STATE_VERSION ?? CONFIG.stateVersion;   // default comes from core/config.ts: change it THERE
export const STATE_BASE = join(HARNESS, ".state");
export const STATE_ROOT = join(STATE_BASE, STATE_VERSION);
/** The workspace the pointer names RIGHT NOW. A long-lived process (the dashboard API) must call this on every request, so a changed pointer is followed without a restart. */
export const currentWorkspace = (): string => { try { return String(JSON.parse(readFileSync(join(STATE_ROOT, "current_pointer.json"), "utf8")).current_workspace); } catch { return "01"; } };
export const workspacePath = (ws: string): string => join(STATE_ROOT, "data", ws);
/** Fixed at import: right for the one-shot processes (test_harness/core/orchistraitor/harness_own_custom/runner/run.ts, the hook, the stand-in): one run stays in ONE workspace even if the pointer moves meanwhile. */
export const WORKSPACE = currentWorkspace();
export const FIXTURES = join(CASES, "agent_fixture");           // index.json, results/, store/ (lives beside the suites; has no main.ts so it is not a suite)
/** Recorded results are NESTED by suite: agent_fixture/results/<suite folder name>/<file>.ts (same names as TestCases/test_folders/Cases/<suite>). */
export const RESULTS = join(FIXTURES, "results");
