// ROOT ROUTE TABLE of all test cases (like a router that mounts sub-routers). Read the index files and you know what is tested where:
//
//   Cases/index.ts                 this file: only the mounts below
//   Cases/core_testing/index.ts    the harness core (ProgressAndFound.md pitfalls) + the plain lead-level cases (solowork, artifact)
//   Cases/real_usecases/index.ts   real products and projects (pipedream, expo_go, planning, project checks)
//   Cases/subagents/index.ts       the sub-agent itself is judged (builder, qa_reviewer, ...)
//
// Everything that finds suites (the runners, scripts/validate_cases.ts, core/fixtures.ts, the UI) goes through `allSuites()` here (via `suiteDirs()` in
// test_harness/core/paths.ts); nobody scans folders to run. A suite that is not routed here is NOT run, and `bun test_harness/scripts/validate_cases.ts` fails
// for it. Add a suite = its folder with main.ts + one route line in the right index.ts. Format and rules: route.ts.
import coreTesting from "./core_testing/index.ts";
import realUsecases from "./real_usecases/index.ts";
import subagents from "./subagents/index.ts";
import { flatten, type FlatSuite, type GroupRoute } from "./route.ts";

export const ROOT: GroupRoute = {
  id: "cases",
  title: "Cases",
  about: "All test cases. Nothing sits directly here: the groups below are mounted (core_testing, real_usecases, subagents).",
  suites: [],   // nothing sits directly in Cases/: every suite lives in a group below
  mount: [coreTesting, realUsecases, subagents],
};

/** Every suite of the tree, with its group label and absolute paths. */
export const allSuites = (): FlatSuite[] => flatten(ROOT, import.meta.dir);
export type { FlatSuite, GroupRoute, SuiteRoute } from "./route.ts";
