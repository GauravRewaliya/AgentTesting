# Where run data lives: `test_harness/.state/<version>/` (the only place)

Both runners (and `TestCases/test_folders/<suite>` run through `core/run.ts`) store results here. The old `test_harness/.state/` is gone.

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
      sessions/<task>/                     ONE session = one lead conversation (task = fx_<case> for core/run.ts, t_<case>_<x> / s<id> for the Experiment runner)
        session.json                       agent tree (lead -> sub-agents: caller, level, fixture, claude session), turns, verdict, cost
        events.jsonl                       spawn / reply / hook events, with real agent ids
        workspace/                         files the agents left after this case
        run/                               raw logs of core/run.ts: trace.jsonl, harness.jsonl, guard.json (raw.json with --raw)
        children/<task>/                   a case that continues this one (`after`): same files
```
Rules (enforced in `core/state2/store.ts`): no session without its workspace, no child without its parent in the same workspace.

## Lookups
- workspace: `current_pointer.json`
- session by id: `index.json` (`session_id` = lead Claude session, or the task id when the runner has none) -> `path`
- latest result of a case: `data/<ws>/last/<case>.json`; its session: `sessions/fx_<case>` (or under its parent's `children/`)
- sub-agent sessions: rows in `session.json` (`agents[]`) and in the index (`sub_sessions[]`)

## Who writes it
| Runner | How |
|---|---|
| `core/run.ts` (fixture sub-agents; `test_basic`, `test_workflows`, ...) | directly: `core/state2/record.ts` + `store.ts`; hook/stand-in write `run/` through `TRACE_FILE`, `GUARD_FILE`, `HARNESS_LOG` |
| Experiment page (f1 harness) | its engine DB stays in `f1_multiagent/ui/.ui-data/`; the UI server (`server/state2.ts`) copies each session in after a turn |
