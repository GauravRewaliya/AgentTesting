# test_folders

Shared test cases, one folder per **suite**. Any harness can run them (f1: `test_harness/core/orchistraitor/f1_multiagent/testrun/run.ts`; the older runner: `test_harness/core/run.ts`).
What is tested is the **lead agent** (does it call the right sub-agent with a good hand-over?). Sub-agents are **mocked by recorded fixtures** (`agent_fixture/`), so a run costs only the lead's tokens.

## Layout
```
test_folders/
  <suite>/main.ts      export const cases: Case[]   (+ optional `export const tags`)   <- a suite = a folder WITH main.ts
  <suite>/cases.json   optional raw data for main.ts (pipedream, handover)
  agent_fixture/       the mocked sub-agents (NO main.ts, so it is not a suite). See below.
  testcase.md          scratch list of reference links, not read by any code
```
## Where everything is declared (one place each)
| What | Declared in |
|---|---|
| case: name, description, tags, agents, chain, flags (`Case`, `Turn`, `Expected`, `SessionRef`) | `TestCases/types.ts` |
| tag vocabulary (`single_ag`/`multi_ag`, `single_prompt`/`multi_prompt`, `artifacts`/`coding`/`split_task`) | `TestCases/tags.ts` |
| mocked sub-agent: `ResultModule`, `Req`, `IndexRow`, `Rule`, `Fixture` | `TestCases/test_folders/agent_fixture/types.ts` |
| expo_go suite shapes (sources, phases, steps, verdicts) | `test_expo_go/lib/types.ts` |
| agent definitions (`AgentDef`) | `test_harness/core/types.ts` + `test_harness/core/helper/agents/<name>.ts` |
| capability names for `needs` | `harness_own_custom/capabilities.ts` |

`test_harness/core/types.ts` only re-exports `Case`/`Turn`/`Expected` and the fixture types, so old `@core/types.ts` imports still work.
In a case: **name** = `title` (+ `id`), **description** = `turns[i].expected.context` (there is no separate description field), **tags** = `tags` (+ the suite's `export const tags`), **agents** = `agents` / `distractors` / `turns[i].allowed`.

### Strictness (compile time + run time)
- Compile time: `tags?: TestTag[]` (only the vocabulary), `allow_real_subAg?: true` (never `false`; in a shared base object write `true as const`), `expected_agents_res: (RecordedId | \`session:${string}#${number}\`)[]`, `Rule`/`ResultModule` shared by guard, gate and results.
- Run time, `bun TestCases/validate.ts` (also run by `fixture_policy.ts`, exit 1 on any problem): unique ids, non-empty title/turns/user/context, valid tags (suite and case), `after` exists, every agent has `core/helper/agents/<name>.ts`, no agent that is also a distractor, `allowed` inside the case's agents, guard file and lead prompt exist, `max_agent_calls` integer >= 1, `needs` exists in `capabilities.ts`, follow-up refs are `session:<agent>#<n>`, and fixture-or-`allow_real_subAg` (a `allow_real_subAg` case whose results are all recorded is also flagged).
- Not checked: that a `RecordedId` exists is checked by `fixture_policy.ts`, not by the type (ids are plain strings).

| suite | cases | what it tests | fixtures |
|---|---|---|---|
| test_basic / test_basic_2 | 3 / 4 | writer + reviewer, same-session follow-ups | recorded + `session:` |
| test_pipedream | 12 | researcher on Pipedream components | recorded (`pd-*`) |
| test_handover | 9 | quality of the hand-over | recorded |
| test_workflows | 5 | multi-step workflows | recorded |
| test_expo_sub_agent / test_expo_proj_planning | 3 / 1 | expo roles (planner, builder, ...) | recorded |
| test_expo_go | 32 | `expo-go` sub-agent redoing real projects phase by phase (+ 1 rework case: bad answer then fix) | recorded (real patches; `eg_lintab_02_rework` = negative + `_fix` positive) |
| advance_test | 4 | staged job: plan, build, fresh reviewer, fix; context loss between stages; follow-up to the reviewer (recorded session); browser QA with a recorded video (Docker) | recorded (`adv-*`, stage-* agents) |
| test_expo_direct_build | 2 | lead must NOT call a sub-agent | `allow_real_subAg` |
| test_solowork | 4 | lead works alone (`router: false`) | `allow_real_subAg` |
| test_artifact | 5 | Claude artifact links (needs the `Artifact` tool) | `allow_real_subAg` |

## The structures
```ts
Case  { id, title, after?, needs?, tags?, router?, lead?, guard?, agents[], distractors?, tools?,
        max_agent_calls?, allow_real_subAg?, external?, turns: Turn[] }
Turn  { user, allowed?: string[], expected: Expected }          // one user message to the lead
Expected { context: string,                                      // plain words a human/judge reads; nothing is asserted from it
           expected_agents_res: string[] }                       // recorded-result ids, in order, or "session:<agent>#n" (follow-up)
```
- `after: "<case id>"` chains: restores the parent's lead session, sub-agent sessions and `run_test` workspace. Several cases with the same `after` are branches.
- `agents` = sub-agents the lead may call; `distractors` = useless ones it must NOT call; `allowed` limits per turn.
- `guard: "<x>_rules.json"` = hand-over rules in `agent_fixture/store/` (e.g. must name `run_test` and `PLAN.md`, min length).
- `router: false` / `lead: "solo"` = the lead works alone. f1 refuses these cases.
- `allow_real_subAg: true` = a call that finds NO recorded fixture may go to the REAL sub-agent (claude with its session id); without it the gate raises "FIXTURE NOT FOUND" and the case fails. Also marks cases that run without any recorded result (see rule below).

## Common flow of a case (what the harness does)
1. Lead (haiku, the only real model) gets the user message of the turn.
2. It calls a sub-agent (`Agent` tool). **Guard** checks the hand-over; a thin one is corrected and may retry (cap `max_agent_calls`, default 2; the call after it FAILS the case).
3. **Lookup** finds the recorded result: all `match.keywords` in the hand-over, else the most similar `expected_input.text`. No hit = `NOTFOUND` in the report.
4. **Serve**: `result.run(req)` copies files from `agent_fixture/store/` / writes into `run_test/` and returns the sub-agent's reply. No model call.
5. **Judge**: who was called vs `expected_agents_res` (code), plus `expected.context` read by a human/Claude against the report.
6. A `session:<agent>#n` follow-up (`SendMessage`) is NOT a recorded result: it is answered from that session's own history.

## agent_fixture (the mock) — one place, nothing else may hold recorded results
```
agent_fixture/
  results/<suite>/<file>.ts   one recorded answer, filed under the SAME folder name as its test suite
                        (results/test_pipedream/, results/test_expo_go/, ...).  default export ResultModule:
                        { id, title, description, match?{agent,keywords[]}, expected_input{text,guardrails_test}, run(req) -> reply string }
                        req = { agent, task, ws, store, cp(from,to), write(path,text) }
  store/                files the results copy from + guard rules
    <name>_rules.json     Rule per role: requires_done[], contains_all[], min_chars, forbidden
    expo_go/              sources.json, phases.json (generated), patches/<name>/NN_<sha>.patch (the real diff, never shown to the agent),
                          bases/<name>/ (start state), apply.ts (shared work of every expo-go result), fetch.sh, make_patches.py
  index.json            GENERATED, one row per result incl. its `suite` and nested `file`: `bun test_harness/core/build_index.ts`.
                        MAINTAINED: fixture_policy.ts fails when it is stale, or when a result is filed under the wrong suite
```
### Fixture rule (compulsory)
Every case is exactly one of: **(a)** expects a recorded result id, **(b)** only `session:` follow-ups, **(c)** `allow_real_subAg: true`. Check, free, no model:
```
bun test_harness/core/fixture_policy.ts      # exit 1 on any undeclared case
```

## test_expo_go specifics
Not solo, so it is `multi_ag` (the suite tag; `tags.ts`: lead handing work to sub-agents): the lead delegates to ONE sub-agent, `expo-go` (planner + builder, `fixtures: true` in its `agent.json`). Declarations live in `test_expo_go/lib/types.ts`; every case is a plain object (shared base `lib/shared.ts`) in `demos/*.ts`, `examples/*.ts`, `rework.ts`. Kinds: build, change (`after` = continues the earlier workspace), rework (bad fixture, then `_fix`).
- **`expo_go: "ok" | "needs_dev_build"`** = the verdict the sub-agent's final `REPORT: {summary, files, skills, expo_go, blockers}` line must give. `ok` = the result runs in the stock **Expo Go** app. `needs_dev_build` = it needs custom native code (a dev build), `blockers` names the packages. It is what the case *expects*; the judge checks that the lead relays it **honestly** (and any `UNVERIFIED` note), and that the recorded result reports the same.
- Case ids: `eg_<key>_<NN>_<sha7>` (phased), `eg_<key>_<NN>_<slug>` (module), or a chosen id (follow-up).
- Phased cases: lead calls expo-go once per phase; hand-over must carry `run_test/<dir>`, `PLAN.md`, `Phase n of N`, the task and what earlier phases did (a call has no memory). Result = base + real patch.
- `follow-up` results are hand-written (no git history): weakest; prefer real patches (`make_patches.py`).

## Add a case
1. Add it to the suite's `main.ts` (tags only from `tags.ts`). Chain with `after`.
2. Record its result in `agent_fixture/results/<this suite's folder name>/<file>.ts` (or set `allow_real_subAg: true` with a reason in a comment).
3. `bun test_harness/core/build_index.ts`, then `bun test_harness/core/fixture_policy.ts` (runs `validate.ts` too; must exit 0).
4. Free check: `bun testrun/run.ts <suite> <id> --fake` from `f1_multiagent/` (FAIL is expected, the fake lead calls nothing); real run = haiku lead only.
