// The one place that knows where things live. Import it as "@core/paths.ts".
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const ROOT = join(import.meta.dir, "../..");            // agent_testing
export const TEST_CASES = join(ROOT, "TestCases");
export const CASES = join(TEST_CASES, "test_folders");          // one folder per suite, each with main.ts
export const HARNESS = join(ROOT, "test_harness");
export const CORE = join(HARNESS, "core");
// ALL run data lives in ONE place: test_harness/.state/<STATE_VERSION>/ (nothing else stores results; the old .state/ is gone).
//   .state/<version>/current_pointer.json   {"current_workspace":"01"}
//   .state/<version>/index.json             session_id -> folder (see core/state/store.ts)
//   .state/<version>/data/<workspace>/      workspace.json, last/, cache/, runs/, sessions/<task>/ (session.json, events.jsonl, run/, workspace/, children/)
// STATE_VERSION is changed BY HAND when the orchestrator changes: a new version starts fresh (empty), the old one stays on disk untouched.
export const STATE_VERSION = process.env.STATE_VERSION ?? "v1";
export const STATE_BASE = join(HARNESS, ".state");
export const STATE_ROOT = join(STATE_BASE, STATE_VERSION);
/** The workspace the pointer names RIGHT NOW. A long-lived process (the dashboard API) must call this on every request, so a changed pointer is followed without a restart. */
export const currentWorkspace = (): string => { try { return String(JSON.parse(readFileSync(join(STATE_ROOT, "current_pointer.json"), "utf8")).current_workspace); } catch { return "01"; } };
export const workspacePath = (ws: string): string => join(STATE_ROOT, "data", ws);
export const workspaceDir = (): string => workspacePath(currentWorkspace());
/** Fixed at import: right for the one-shot processes (core/run.ts, the hook, the stand-in): one run stays in ONE workspace even if the pointer moves meanwhile. */
export const WORKSPACE = currentWorkspace();
export const WORKSPACE_DIR = workspacePath(WORKSPACE);
export const RUN_TEST = join(HARNESS, "run_test");
export const FIXTURES = join(CASES, "agent_fixture");           // index.json, results/, store/ (lives beside the suites; has no main.ts so it is not a suite)
/** Recorded results are NESTED by suite: agent_fixture/results/<suite folder name>/<file>.ts (same names as TestCases/test_folders/<suite>). */
export const RESULTS = join(FIXTURES, "results");
export const resultFiles = (dir = RESULTS): { suite: string; file: string; path: string }[] =>
  !existsSync(dir) ? [] : readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).flatMap((d) =>
    readdirSync(join(dir, d.name)).filter((f) => f.endsWith(".ts")).sort().map((f) => ({ suite: d.name, file: f, path: join(dir, d.name, f) })));
export const HELPER_AGENTS = join(CORE, "helper/agents");
