# 04 Tests

Rules from `../../CLAUDE.md`: fixture-first, spend few credits, free checks before and after (`bun test_harness/scripts/check_fixtures.ts`).

## Exists
Suite `TestCases/test_folders/Cases/real_usecases/real_planning_prototype/main.ts` (REAL sub-agents, `allow_real_subAg: true`, `max_agent_calls: 8`; not for routine runs):
- `real_instagram_prototype`: Instagram-like app; flow only (sign up/log in, feed, posts, likes, comments, profiles, follow, stories, explore, DMs, notifications).
- `real_composio_admin_prototype`: Composio-like admin dashboard; features only (integrations catalog, auth configs, connected accounts, tools, triggers, execution logs, API keys, projects/team, usage/billing).

The long comment at the end of that file states the expectation: planner first, files under `docs/planning/<project>/`, FE-only prototype (layout first, then exact UX/UI with one theme), fake data, no backend, prototype shown to the user, feedback awaited.

Run one case by id only, in the sandbox:
`cd test_harness/core/orchistraitor/f1_multiagent && HARNESS_SANDBOX=docker bun testrun/run.ts real_planning_prototype real_instagram_prototype --real`
(`--list` and `--fake` are free.)

## Also written (REAL, no fixtures, not run yet)
- `real_small_no_planner`: small clear job; the lead must NOT call the planner.
- `real_prototype_feedback`: 2 turns; user change goes to the SAME planner, plan and prototype updated.
- `real_fe_issue_to_planner`: a plan/data conflict goes to the planner, which updates the plan and writes a decision.
- `real_end_to_end_plan_build`: plan, prototype, then FE/BE parallel build with sqlite, `qa_check`.

- `real_phase_order`: phase 2 is not started before phase 1 passed (`check_phases.ts`).
- `real_type_error_caught`: seeded strict TS project; builder must run tsc/LSP before done.

Free helpers: `bun test_harness/scripts/check_phases.ts <PHASES.md>` (n+1 waits for n) and `bun test_harness/scripts/check_plan_links.ts docs/planning/<project>` (every relative md link must exist).
