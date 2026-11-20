> **DEPRECATED (2026-11-20)**: see DEPRECATED.md in this folder. The live engine is ../f3_multiagent.

# f1_multiagent

## Two engines live here (read this first)
- **Current: the lead engine.** `harness/tools.ts` (the `team <cmd>` commands), `harness/lead.ts`, `core/board`, `core/agent_call`, `core/callee`; agents in `harness/agents/` (lead, builder, lookup, planner ...); run by `testrun/run.ts`. Prompts: `agents/<name>/agent.json` (`prompts`, `team_tools`) and `.claude/CLAUDE.md`; the lead's flows are `agents/lead/chapters/`.
- **Legacy: the stage loop** (planner > builder > reviewer rounds): `core/base/{loop,stages,checks,briefs}.ts`, `pipelines/default.json`, `harness/main.ts`, the `stage-*` agents. Only `TestCases/test_folders/Cases/core_testing/advance_test` uses it. Do not extend it; move it to `legacy/` when that suite is retired.

## Whose is what

f1_multiagent is its **own** harness. agent_testing only uses it to run the shared cases (`TestCases/test_folders`). So:

| | what | who looks after it |
|---|---|---|
| **f1's own** | `harness/` (lead, tools, registry, locks, worktrees, patches, board, hooks, the other agents), `self_test/` (its own regression suite, `bun self_test/multi.ts`, 169/169), `ui/` (its console and its `.ui-data/`), `testrun/chat.ts` (the console's chat), `dependency.md`, `docs/` | f1. agent_testing does not test or change it, except where listed in the next row. Run `self_test/multi.ts` once if you touch `harness/`. |
| **ours** (added for agent_testing) | `testrun/run.ts` + `testrun/cases.ts` (run and judge shared cases), `harness/core/fixture_gate.ts`, `fixture_sessions.ts`, `workspace_read.ts` (mocked sub-agents, session table, observer, read-only lead tools), the `ls / read_file / grep` commands in `harness/tools.ts` and `harness/lead.ts`, the agents `expo-go` and `stage-*`, one line in `harness/core/base/call.ts` (a mocked agent has no claude transcript), and the infra in `test_harness/infra/` (S3, QA video container) | agent_testing. Keep tidy; documented in `user_read.md` and `PROGRESS.md`. |

Nothing was moved, on purpose: f1's files import each other by relative path. Our runner does not read or write `ui/.ui-data/`; it keeps its files in `test_harness/.state/v1/<master session>/{store,workspace}`.

The f1 multi-agent harness: a lead agent that delegates to sub-agents, with a registry (store), locks, worktrees + patches and a board.

* `harness/`  the harness itself (`lead.ts`, `tools.ts`, `core/`, `hooks/`, `agents/<name>/` = `agent.json` + `.claude/CLAUDE.md` + `settings.json` [+ `.claude/skills/`]).
* `ui/`       its console (`.ui-data/` = local state, git-ignored).
* `testrun/`  runs the **shared** cases (`TestCases/test_folders/Cases/<suite>/main.ts`) on this harness.
* `self_test/` this harness's **own** tests and experiments.

## Claude profile
- **Docker** (real sub-agents, `HARNESS_SANDBOX=docker`): ALWAYS `~/.claude-personal`. `test_harness/infra/docker-compose.yml` mounts it as the container's Claude config dir (`/claude`); it does not follow your shell's `CLAUDE_CONFIG_DIR` (`CLAUDE_PROFILE_DIR` overrides it).
- **Local** (the lead and any `claude -p` the harness starts on the host): ALWAYS `~/.claude-personal` too. The harness sets `CLAUDE_CONFIG_DIR` itself on every `claude` it starts (`claudeEnv()` in `harness/core/base/runner.ts`), whatever the shell or the UI server has; it prints a warning when the shell has another one. Run your own shell with `CLAUDE_CONFIG_DIR="$HOME/.claude-personal" claude` as well. `HARNESS_CLAUDE_PROFILE` is the only override. Old sessions in `~/.claude` are still READ (history) and resumed in the profile that holds them; nothing new is written there.
- A session is resumed in whichever profile holds it (`runner.ts` `profileOfSession`).

## Tests: two kinds, and only one of them is global
| | where | scope | run |
|---|---|---|---|
| shared cases | `TestCases/test_folders/Cases/<suite>/` | global: any harness can run them | `bun testrun/run.ts <suite> [case ...] [--list] [--fake] [--rerun]` |
| harness tests | `self_test/` | **local to f1**: not global, they test f1's own machinery | see below |

### Extra flags (passed from OUTSIDE the harness)
Some harnesses do these things internally; f1 does not, so the runner takes a flag and calls a helper in `test_harness/core/`:
| flag | what | helper |
|---|---|---|
| `--video` | after each case, record a QA video into `<session>/store/qa/` (Docker, no network, read-only app folder). A web page is recorded as is. An **Expo app with web support** (`react-native-web` in package.json) is first exported in a throwaway container (`infra/qa/web_export.ts`: `pnpm install` + `expo export --platform web` inside Docker, network on for that step only, nothing on the host; the export goes to `<session>/store/web/<app>/dist`), then recorded. An Expo app without web support, or a failed export, records nothing and `store/qa/NO_VIDEO.txt` says why. `QA_EXPO_EXPORT=0` skips the export. Off by default. Needs the image once: `bun test_harness/infra/qa/run_qa.ts --build`. Env `QA_SANDBOX=docker\|off\|e2b` (e2b not implemented) | `test_harness/infra/qa/video.ts` (`videoAfterRun`, `findWebApps`) |
| `--video-route=/screen` | with `--video`: which screen of the app to open (an Expo Router route, e.g. `/3d-rotate`) | `test_harness/infra/qa/video.ts` |
| env `HARNESS_SANDBOX=docker` | real sub-agents (not the lead, not agents that delegate) run `claude -p` in a Docker container: compose service `sandbox`, image `agent-testing-claude:1`, 2 GB / 1 CPU, your claude-personal profile mounted | `harness/core/base/docker_runner.ts` |
| `bun testrun/par.ts <suite> --jobs=4` | run the independent chains of a suite in parallel (all other flags go to run.ts). A case costs 20 to 70 s because the LEAD is a real model; sub-agents are fixtures. Env `HARNESS_MAX_LEADS` (default 1) is how many leads may run at once machine-wide; par.ts sets it | `testrun/par.ts` |
| `--fake` | scripted lead, no model calls | built in |
| env `HARNESS_CASE_CAP_USD` / `Case.max_cost_usd` | real-money cap per case (default $1): over it the case fails with a COST CAP gate | `testrun/run.ts` |
| `--rerun` | run a case again in a new task | built in |

### Power layer (phase gates, peek, slash commands, budget; see `docs/POINTS.md`)
* Tools (`tools.ts`): `phase_pass --plan --phase --evidence`, `phase_status --plan`, `agent_peek --agent [--n]`, `cost`; `plan_submit` tasks take `phase: N`.
* Chat slash commands (no model call): `/help /status /agents /plan /phases /peek /cost /bg /pause /resume /stop /say`.
* Env `HARNESS_PROJECT_BUDGET_USD`: new agent calls are refused (`budget_exceeded`) once the team's spend reaches it.
* Test: `bun self_test/power.ts` (38 checks, offline).

### testrun/ (runs the shared cases; OURS, see the table above)
* `run.ts`   a suite, case by case, on the f1 lead. Real `claude` (haiku, cents per turn) by default; `--fake` = scripted agents, no model calls. State goes to `test_harness/.state/v1/<task>/{store,workspace}` (one folder per master session; it no longer touches `ui/.ui-data/`).
* `chat.ts`  one chat turn with the lead (what the console and the dashboard's "Start/Send" use).
* `cases.ts` loads the suites and judges a turn by WHO the lead called against `expected_agents_res` (nothing is asserted from the model's words).

A case is judged by who was called, not by the files it produced. A case that expects a recorded result with no fixture prints a warning (see "Fixtures").

### self_test/ (f1's own; scripts)
* `multi.ts`      offline suite (scripted agents, real harness code, real git); `--real` adds ~12 haiku calls.
* `scenario.ts`   one task, three messages, run through both harnesses and timed.
* `compare.ts`    which set-up is cheaper / better (same tasks, real `claude -p`).
* `ui_checks.ts`, `ui_page.ts`   the console and its page script, no model calls.
* `lib.ts`, `fake_claude.ts`, `redis_worker.ts`   test kit, a `claude -p` stand-in with the CLI's session rules, a lock stress-test contender.
Run each with `bun self_test/<file>.ts` (the headers say which flags).
The `*.log`, `*_results*.json` and `*_report.md` files in `self_test/` are the **output of earlier runs** (kept as evidence, not inputs).

## Fixtures (recorded sub-agent work)
They live in ONE place: `TestCases/test_folders/agent_fixture` (see its README). A case that expects a recorded result which does not exist prints a warning that recommends recording it there; a case sets `allow_real_subAg: true` to run without one on purpose (no warning). `bun test_harness/scripts/check_fixtures.ts` scans every suite and exits 1 if any case is missing a fixture and has not opted out.

An agent with `"fixtures": true` in its `agent.json` (today: `expo-go`) is a pure forwarder in test mode: its only tools are `tools.ts fixture lookup` (finds the recorded result for its hand-over) and `tools.ts fixture run <id>` (applies the recorded work in `./run_test/` and prints the answer).
