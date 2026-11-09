// The one place that knows where things live. Import it as "@core/paths.ts".
import { join } from "node:path";

export const ROOT = join(import.meta.dir, "../..");            // agent_testing
export const TEST_CASES = join(ROOT, "TestCases");
export const CASES = join(TEST_CASES, "test_folders");          // one folder per suite, each with main.ts
export const HARNESS = join(ROOT, "test_harness");
export const CORE = join(HARNESS, "core");
export const STATE = join(HARNESS, ".state");
export const RUN_TEST = join(HARNESS, "run_test");
export const FIXTURES = join(CORE, "agent_fixture");            // index.json, results/, store/
export const HELPER_AGENTS = join(CORE, "helper/agents");
