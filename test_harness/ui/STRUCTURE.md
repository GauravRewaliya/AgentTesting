# Where run data lives: `test_harness/.state/<version>/` (the only place)

Both runners (and `TestCases/test_folders/<suite>` run through `test_harness/core/orchistraitor/harness_own_custom/runner/run.ts`) store results here. The old `test_harness/.state/` is gone.

## Version
`STATE_VERSION` in `test_harness/core/paths.ts` (or env `STATE_VERSION`). **Changed by hand when the orchestrator changes**: the new version starts empty, the old one stays on disk untouched. Nothing is migrated between versions.

## Layout
```
.state/
  v1/                                      <- STATE_VERSION
    current_pointer.json                   {"current_workspace":"01"}   (read on every API request)
    index.json                             PARENT sessions only: session_id, task, case, verdict, cost, path, sub_sessions[], children[]
    data/<workspace>/
      workspace.json                       which harness made it, which workspace it came after
      last/<case>.json                     latest result of a case (the Flow page reads it)
      cache/<case>.<n>/                    archived earlier runs (a --rerun archives, never deletes)
      runs/<run>.json|.log|.exit           runs started from the UI
      sessions/<task>/                     ONE session = one lead conversation (task = fx_<case> for test_harness/core/orchistraitor/harness_own_custom/runner/run.ts, t_<case>_<x> / s<id> for the Experiment runner)
        session.json                       agent tree (lead -> sub-agents: caller, level, fixture, claude session), turns, verdict, cost
        events.jsonl                       spawn / reply / hook events, with real agent ids
        workspace/                         files the agents left after this case
        run/                               raw logs of test_harness/core/orchistraitor/harness_own_custom/runner/run.ts: trace.jsonl, harness.jsonl, guard.json (raw.json with --raw)
        children/<task>/                   a case that continues this one (`after`): same files
```
Rules (enforced in `test_harness/core/orchistraitor/harness_own_custom/runner/state/store.ts`): no session without its workspace, no child without its parent in the same workspace.

## Lookups
- workspace: `current_pointer.json`
- session by id: `index.json` (`session_id` = lead Claude session, or the task id when the runner has none) -> `path`
- latest result of a case: `data/<ws>/last/<case>.json`; its session: `sessions/fx_<case>` (or under its parent's `children/`)
- sub-agent sessions: rows in `session.json` (`agents[]`) and in the index (`sub_sessions[]`)

## Who writes it
| Runner | How |
|---|---|
| `test_harness/core/orchistraitor/harness_own_custom/runner/run.ts` (fixture sub-agents; `test_basic`, `test_workflows`, ...) | directly: `runner/state/record.ts` + `store.ts`; hook/stand-in write `run/` through `TRACE_FILE`, `GUARD_FILE`, `HARNESS_LOG` |
| Experiment page (f1 harness) | its engine DB stays in `f1_multiagent/ui/.ui-data/`; the UI server (`server/state.ts`) copies each session in after a turn |


## User home (not run data): `test_harness/.state/home/`
Settings (agents, integrations), secrets (mode 600), `custom_claude/{agents,skills}`, `chrome-profile/`, `browser.json`, `artifact_runs/`. One folder per user (one user now); it sits beside `v3/`, not inside a run version. Code: `test_harness/core/userhome.ts`. Plan/status: `ui/PLAN_SETTINGS.md`.


## TestCases page (first page)
Tabs: PromptTesting (TestCases/test_folders/prompt_test, results in `.state/<version>/prompt_tests/`), Real cases (real_usecases + subagents; readiness marks in `.state/home/case_marks.json`), Core (core_testing). Code: `src/pages/TestCasesPage.vue`, `PromptTestingPage.vue`, `src/components/prompt/`, `server/prompttests.ts`.


## PromptTesting page: how a result gets on screen (read this before you say "the UI is stale")
Files: `ui/server/prompttests.ts` (data), `server/hub.ts` (topic `prompttests`), `src/store/promptTests.ts` (verdicts), `src/pages/PromptTestingPage.vue`. Vite on :5173 proxies `/api` to the Bun API on :5189 (`bun server/index.ts`).
- **The catalog** (cases, sizes) is ONE HTTP load: `GET /api/prompt-tests`. It holds NO results. **Results, runs and marks come over the WebSocket** topic `prompttests` (`live.prompttests`), so a plain curl of the API shows none; the browser must be subscribed (page open) to get them.
- **Which result is shown:** `results()` reads every folder `.state/v3/prompt_tests/<suite>-<time>/<case>.json` and, per case id, the NEWEST folder wins (sorted by folder name). Consequences:
  1. A case that ran only as the PARENT of a child (history) is saved too and OVERWRITES its older result with that one run.
  2. A child whose parent did not pass is saved as `skipped` and then shows `skip`, replacing an older real result.
  3. Verdict = `pass` only when ALL runs of that newest result pass (`--runs=2` with one failure = `fail`); a case with only skipped runs = `skip`; no file = `never`.
  4. A run saves its folder only when it FINISHES: a killed run (or one started from the page and stopped) leaves nothing, the page keeps the older result.
  5. No stale marker yet: a result stays after the case or the prompt changed (T-40: hash of the definition not built). Re-read the stamp (folder time) before you trust a pass or a fail.
- **A run from the page** (`POST /prompt-tests/run`, one at a time, real credits) spawns `bun test_harness/scripts/prompt_test.ts <suite> <ids> --review`; the same folders are written as by a CLI run, so a CLI run and a page run show up the same way (and either one may overwrite the other's newest result).
- **Do not judge "the page shows something different" without reading `results()` rules above and listing the newest folders (`ls -t .state/v3/prompt_tests`).** The marks (`mark fixed`, `known issue`) are kept in `.state/home/prompt_marks.json`; they do not change a result.


## Settings > Team page
`src/pages/settings/TeamSection.vue` (tabs Agents / Skills / Mod), data from `server` routes `/api/team*` (one load per click, no socket topic: nothing here changes by itself), contract in `shared/team.ts`, logic in `test_harness/core/orchistraitor/f3_multiagent/harness/core/team_view.ts`. Skills you add are saved in `<home>/team/` (the user home), never in the repo.
