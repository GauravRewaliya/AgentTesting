// THE ONE PLACE that says which orchestrator, which approach and which run-data version are current.
// Change a value here and every consumer follows (test_harness/core/paths.ts reads stateVersion; env STATE_VERSION still overrides for one run).
//   orchestrator   folder under test_harness/core/orchistraitor/ that is the current engine
//   approach       how the lead delegates (f3_multiagent/approaches/<name>); env APPROACH overrides for one run
//   stateVersion   run data lives in test_harness/.state/<stateVersion>/ (a new version starts empty, the old one stays on disk)
// This file must import NOTHING from the project (paths.ts imports it).
export const ENGINE = {
  orchestrator: "f3_multiagent",
  approach: "a1_team_cli",
  stateVersion: "v3",
} as const;
// TODO: UI server / helper still import f1_multiagent by path (docs/08_MIGRATION_STEPS.md step 9); they should resolve ENGINE.orchestrator instead.
