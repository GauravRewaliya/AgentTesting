# 03 Core inventory (from the coupling research)

Refs are under `f1_multiagent/harness/core/` unless stated. Verified by grep: **no file in `core/` imports `tools.ts` or `lead.ts`**. The coupling is by string and prompt, not by import.

| Class | Files | Note |
|---|---|---|
| AGNOSTIC -> `core/` | `base/store.ts`, `base/types.ts`, `board.ts`; `locks.ts`, `lockapi.ts`, `locks_redis.ts`; `worktree.ts`, `patches.ts`; `bg.ts`, `procs.ts`; `plan.ts`, `phases.ts`, `plan_lint.ts`; `monitor.ts`, `base/watchdog.ts`, `invariants.ts`, `base/hung.ts`, `peek.ts`; `base/runner.ts`, `docker_runner.ts`, `slots.ts`, `sessions.ts`, `archive.ts`, `call.ts`, `briefs.ts`, `agents.ts`, `parse.ts`, `trace.ts`, `guard.ts`; `models.ts`; `session_run.ts`, `status_reply.ts`, `loops_ai.ts`, `preview.ts`; browser/ref/proto tools; `hooks_settings.ts`; `agent_call.ts`; `callee.ts`; `../hooks/guard.ts`, `../hooks/activity.ts` | `agent_call.ts` is the delegation backend any approach must call |
| TOOLS-COUPLED -> `a1_team_cli/` | `harness/tools.ts`, `harness/lead.ts`, `core/launch.ts` (`DELEGATE_ENTRY` line 10, team-tools block line 36, bug block line 56), team lines in `agents/*/.claude/CLAUDE.md` | `harness/bin/team` is a shell over `tools.ts` |
| MIXED (split) | `pm.ts` (line 62 builds a `tools.ts` command), `slash.ts` (line 14 spawns `tools.ts`, line 12 imports `planTable` from `pm.ts`), `base/agents.ts:55 usesTeamTools`, `base/runner.ts:49`, `loops_ai.ts` (`planBlurb`, `memoryBlock` feed prompts) | `// ImprovementsNeeded:` move command-string building behind the port |
| TEST-ONLY -> `core/fixtures/` | `fixture_gate.ts`, `fixture_sessions.ts`, `workspace_read.ts` | `workspace_read.ts` is documented as for `tools.ts ls`; gate must sit behind `core.delegate`, not behind `tools.ts` |
| LEGACY (leave behind) | `base/loop.ts`, `base/stages.ts`, `base/checks.ts`, `pipelines/default.json`, `harness/main.ts` stage loop | only `advance_test` uses it |

## Who imports `harness_own_custom`
`fixture_gate.ts:23` -> `loadResults, pickRecorded, type Recorded` from `harness_own_custom/main.ts`
`fixture_gate.ts:24` -> `checkHandover, type Rule` from `harness_own_custom/core/guard.ts`

`// TODO:` lift these into `core/fixtures/` so core no longer reaches into an approach folder.

## Who imports `runLead` (a1)
`testrun/run.ts:23`, `testrun/chat.ts:11`, `ui/server.ts:16`, `self_test/{ui_checks:10, scenario:14, compare:11, multi:47}.ts`.
`tools.ts` is only ever spawned (`bun --smol tools.ts`) by `lead.ts`, `pm.ts`, `slash.ts`, `main.ts:61`; `agents/*/.claude/settings.json` allow-list it.
