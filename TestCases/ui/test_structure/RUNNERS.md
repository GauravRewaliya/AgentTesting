# The two runners: what each one is, where it writes, how to test

Both read the SAME cases (`TestCases/test_folders/<suite>/main.ts`) and the same recorded sub-agent answers (`TestCases/test_folders/agent_fixture`). They differ in the runner and in where the result is stored.

| | 1st: fixture-mock runner | 2nd: Experiment (f1 multi-agent) |
|---|---|---|
| UI | Flow page `/`, Test page `/test/:caseId`, button **▶ Run all** | `/experiment` page, **＋ New session** or `testrun/run.ts` |
| Command | `cd test_harness && bun core/run.ts <suite> <case...> [--rerun]` | `cd test_harness/core/orchistraitor/f1_multiagent && bun testrun/run.ts <suite> <case...> [--fake] [--rerun]` (a chat message: `bun testrun/chat.ts --task <id> --text-file f`) |
| Lead | real `claude -p` (haiku) | real master (`lead`) of the f1 harness, with its own agents, locks, board |
| Sub-agents | **always answered from `agent_fixture/results`** by a PreToolUse hook (cost ~0) | real sub-agents, or fixture-limited (`fixture.limit`), or `--fake` (no model calls) |
| State | `test_harness/.state/<version>/data/<workspace>/` (`current_pointer.json` says which workspace is current): `last/<case>.json` result, `sessions/fx_<case>/` (session.json, events.jsonl, run/, workspace/), `cache/<case>.<n>/` archived reruns, `runs/` UI runs | `f1_multiagent/ui/.ui-data/`: `store.json` (agents, calls, events, notes), `exp.json` (case -> task), `logs/<task>/*.jsonl` (Claude transcripts), `repo/`, `web_runs/`, `web_sessions/` |
| Unit of work | one case, turns run in a row, result cached (CACHED unless `--rerun`) | one **session** (task id `t_<case>_<suffix>`), a chat you can continue message by message |
| Verdict | actual responders vs `expected_agents_res` (+ guard, notfound) in `core/run.ts` / `report.ts` | `judgeTurn` in `testrun/cases.ts`, shown as Verdict on `/experiment` |
| Use it for | "does the lead call the right sub-agent with a good hand-over?" quickly and cheaply | "does the whole team work?" with live status, queue, delete, continue chatting |

A UI run on the Flow/Test page never creates an Experiment session, and an Experiment session is copied into `.state` by the UI server after its turn. They share only the case definitions and fixtures. (They also both write `run_test/`, so only one at a time.)

## The common structure (what you author once)
```
TestCases/test_folders/<suite>/main.ts       export const cases: Case[]
  { id, title, tags, after?, needs?, turns: [ { user, expected: { context, expected_agents_res: ["<result id>"] } } ] }
TestCases/test_folders/agent_fixture/
  results/<id>.ts      recorded sub-agent answer: match.keywords, run(req) writes files + returns the reply
  store/               files and guard rules those answers copy from
  index.json           generated: bun test_harness/core/build_index.ts
```
`after` links cases into a chain: running a case runs its ancestors first.

## How to test it (checklist)
1. List: `cd test_harness && bun core/run.ts <suite> --list`
2. Run (1st): `bun core/run.ts <suite> <case> --rerun`, or press **▶ Run all** on `/test/<case>`; read `.state/<version>/data/<ws>/last/<case>.json` or the log.
3. Judge: **⚖ Judge with claude** on the run (left panel on Flow, or the run panel on the Test page).
4. Run (2nd): `/experiment` > ＋ New session > pick the case (tick **fake runner** first to test without cost), or `bun testrun/run.ts <suite> <case> --fake`.
5. Compare: for the same case, `actual` responders in `.state/<version>/data/<ws>/last/<case>.json` should match the Experiment turn's calls.

## Reading a failed result
`last/<case>.json` has per turn `expected`, `actual`, `match`, `guard`, `notfound`, `calls`, `reply`. `match:false` with `actual` longer than `expected` means an extra call happened (for example a follow-up `session:builder#1` that no recorded result serves).
