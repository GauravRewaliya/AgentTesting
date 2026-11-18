// THE ONE DOOR to the current orchestrator for everything outside test_harness/core/orchistraitor: test cases, the console (test_harness/ui), helpers.
// They import THIS file (`@core/orchestrator.ts`), never a path like orchistraitor/<folder>/..., so switching orchestrators touches only engine.ts and this file.
// When CONFIG.orchestrator (config.ts) changes, replace the folder name in the lines below (one search-and-replace in this file).
import { join } from "node:path";
import { CONFIG } from "./config.ts";

/** Absolute path of the current orchestrator folder (its harness/agents, testrun/run.ts, ...). */
export const ORCH_DIR = join(import.meta.dir, "orchistraitor", CONFIG.orchestrator);

export { MStore, say } from "./orchistraitor/f3_multiagent/harness/core/board.ts";
export { FixtureGate } from "./orchistraitor/f3_multiagent/harness/core/fixture_gate.ts";
export { claudeDirs } from "./orchistraitor/f3_multiagent/harness/core/base.ts";
export { activeMs, lastCall } from "./orchistraitor/f3_multiagent/harness/core/peek.ts";
export { costOf, stopAgent } from "./orchistraitor/f3_multiagent/harness/core/agent_call.ts";
export { locksFromEnv } from "./orchistraitor/f3_multiagent/harness/core/lockapi.ts";
export { lintPlan } from "./orchistraitor/f3_multiagent/harness/core/plan_lint.ts";
export { bgLog, getBg, listBg, restartBg, stopBg } from "./orchistraitor/f3_multiagent/harness/core/bg.ts";
export { publicHost } from "./orchistraitor/f3_multiagent/harness/core/preview.ts";
export { listTaskProcs, stopTaskProc } from "./orchistraitor/f3_multiagent/harness/core/procs.ts";
export * as browserConn from "./orchistraitor/f3_multiagent/harness/core/browser_conn.ts";
export { browse } from "./orchistraitor/f3_multiagent/harness/core/browse.ts";
export { judgeTurn, loadSuites, reconcileDead, readExp, statusOf, unsupported, writeExp } from "./orchistraitor/f3_multiagent/testrun/cases.ts";
export type { ExpEntry, SuiteCase } from "./orchistraitor/f3_multiagent/testrun/cases.ts";
export { loadAgentsRaw } from "./orchistraitor/f3_multiagent/harness/core/base/agents.ts";
export { launchDef } from "./orchistraitor/f3_multiagent/harness/core/launch.ts";
export { buildLead } from "./orchistraitor/f3_multiagent/approaches/a2_native_hook/adapter.ts";
