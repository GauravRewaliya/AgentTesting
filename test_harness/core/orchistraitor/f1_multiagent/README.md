# f1_multiagent

The f1 multi-agent harness: a lead agent that delegates to sub-agents, with a registry (store), locks, worktrees + patches and a board.

* `harness/`  the harness itself (`lead.ts`, `tools.ts`, `core/`, `hooks/`, `agents/<name>/` = `agent.json` + `.claude/CLAUDE.md` + `settings.json` [+ `.claude/skills/`]).
* `ui/`       its console (`.ui-data/` = local state, git-ignored).
* `testrun/`  runs the **shared** cases (`TestCases/test_folders/<suite>/main.ts`) on this harness.
* `self_test/` this harness's **own** tests and experiments.

## Tests: two kinds, and only one of them is global
| | where | scope | run |
|---|---|---|---|
| shared cases | `TestCases/test_folders/<suite>/` | global: any harness can run them | `bun testrun/run.ts <suite> [case ...] [--list] [--fake] [--rerun]` |
| harness tests | `self_test/` | **local to f1**: not global, they test f1's own machinery | see below |

### testrun/ (needed by the dashboard's ExperimentRun page)
* `run.ts`   a suite, case by case, on the f1 lead. Real `claude` (haiku, cents per turn) by default; `--fake` = scripted agents, no model calls. State goes to `ui/.ui-data/`.
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
They live in ONE place: `TestCases/test_folders/agent_fixture` (see its README). A case that expects a recorded result which does not exist prints a warning that recommends recording it there; a case sets `allow_real_subAg: true` to run without one on purpose (no warning). `bun test_harness/core/fixture_policy.ts` scans every suite and exits 1 if any case is missing a fixture and has not opted out.

An agent with `"fixtures": true` in its `agent.json` (today: `expo-go`) is a pure forwarder in test mode: its only tools are `tools.ts fixture lookup` (finds the recorded result for its hand-over) and `tools.ts fixture run <id>` (applies the recorded work in `./run_test/` and prints the answer).
