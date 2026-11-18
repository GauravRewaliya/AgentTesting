# prompt_test: prompt testing (flag `prompt_testing`)

Test an agent's PROMPT without a session, fixtures or a workspace: one short call of ONE agent with its real launch prompt and real tools; a hook records every tool call and blocks it (nothing runs). Cases CHAIN like the harness cases (`after`; a second child of one parent is a branch), so a flow is tested phase by phase and a failed phase stops its children.

| file | what it tests |
|---|---|
| `master_test.ts` | the master alone, one decision per case (routing, counting, hand-over, no agents for small talk, fan-out for heavy work) |
| `master_test2.ts` | the master and the PLANNER: ask -> plan -> person approves -> build; changes and questions branch off |
| `master_test3.ts` | a plan exists: split into builders started together, proper hand-overs, wait / fix / QA / retry loops and when to STOP |
| `<agent>_test.ts` | builder, qa_reviewer, planner, researcher, lookup, ux_designer: each agent's own behaviour |

```ts
{ id, flag: "prompt_testing", agent, about, why?, after?, tags?: ["cost"|"loop"|"split_task"],
  messages?, stuff?: [{ title, text }],   // earlier turns / what the agent already has (results of its last calls)
  user_message,                           // the person's words (master) or the hand-over (a sub-agent)
  expect: { calls, not_calls, no_calls, first_call, same_turn, disjoint_writes, text_has, text_not, judge } }
```
- `calls` (+ve) / `not_calls` (-ve) match tool calls by `tool`, `role`, `match` (regex on the input), `min` / `max`, `any: [...]`, and `each: [regex]` (every matching call must carry all of them: a PROPER hand-over). A fork_all counts one per task.
- `any_of: [expect, ...]` = the agent must do at least ONE of these acceptable things (each alternative is a full expectation). Use it so a purely negative case cannot pass by silence: the agent must DO something acceptable (answer, look first, call the right agent).
- `same_turn` = the calls came in ONE assistant turn = they start together (parallel); that is how "did it split the work, or call one agent only?" is tested. `disjoint_writes` = the builders own different files (`WRITES:` lines / fork_all `writes`).
- `why` says in plain words what a bad prompt would do; it is printed next to EXPECTED / GOT when a case fails. `judge` is a line for a human (printed with `--review`, shown on the page, never asserted).
- Tags: `cost` = token-consuming on purpose (loops, fan-out, heavy work), `loop` = a repeat to continue or stop, `split_task`. `--tag=cost` / `--skip-tag=cost` select them (TestCases/tags.ts).

Run (about $0.02 a case, sonnet; a whole suite is a few minutes). You do NOT need to run everything: one suite (`master_test`) is a good baseline.
```
bun test_harness/scripts/prompt_test.ts master_test                    a suite (or an agent name: master, builder ...)
bun test_harness/scripts/prompt_test.ts master_test3 m3_11e_...        one case (its parents run first as history)
bun test_harness/scripts/prompt_test.ts master_test --tag=cost --runs=3   cost-tagged cases, 3 runs each (flakiness)
bun test_harness/scripts/prompt_test.ts master_test --skip-tag=cost --review   EXPECTED and GOT for every case
bun test_harness/scripts/prompt_test.ts builder_test --dry             build the prompts, no model call
bun test_harness/scripts/check_prompts.ts [--strict]                   FREE: prompt sizes (file and launch), shouting caps, shape of every case here
```
Results: `test_harness/.state/<version>/prompt_tests/<suite>-<time>/` (`<case>.json` + `REVIEW.md` with expected and got for a look by hand). The dashboard shows them: **TestCases > PromptTesting** (suites, the chain of each flow, expected vs got, run buttons, prompt sizes); Real cases and Core are the other two tabs.
Rules of thumb: one behaviour per case; give the agent in `stuff` what it would have at that step (a master that has not read the plan or the contract reads it first, which is correct); state the -ve side as often as the +ve; assert decisions, not wording. Change a prompt -> run that agent's suite before and after.
Limits: single turn only (the first decision, not a whole run); the master is tested in its a2 launch (native Agent + typed team tools); the a1 shell-command lead is not covered.
