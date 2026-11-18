# Test_agent_3

Tests the **harness**: does the main (lead) agent hand work to sub-agents correctly, and keep or separate
their sessions correctly? Sub-agent *work* is mocked (fixture lookup + file copy), sub-agent *sessions* are real.

## Layout
| Path | What |
|---|---|
| `run_test/` | scratch workspace, empty at rest (wiped around each case; `--keep` leaves it) |
| `test_harness/core/agents/` | the agents: `main_flow_agents/` (real team) and `test_agents/` (test stand-ins), listed by `index.ts` (name, role, description from each agent.json) |
| `TestCases/test_folders/agent_fixture/` | everything a mocked sub-agent needs: `results/<id>.ts` (each is ONLY `run(req)`), `store/` (files the scripts copy), `index.json` (generated: `bun core/build_index.ts`) |
| `core/` | Bun/TS runner: `run.ts` CLI, `claude.ts` spawn+parse, `interpose.ts` hook + mock, `report.ts` run report, `types.ts` |
| `test_case/<suite>/main.ts` | `export const cases: Case[]` |
| `test_harness/.state/<version>/` | ALL run data: one session folder per case (agent tree, events, workspace copy, raw logs), `last/`, `cache/`, `runs/`, pointer + index |

## Core structure and the mount
```
core/
  harness_own_custom/core/main.ts   OUR OWN multi-agent runtime (no tie to the project or to Claude Code):
                               spawn -> always a NEW session id; send -> SAME session only; sessions isolated;
                               every event logged. Offline rules test: bun test core/harness_own_custom/test
  run.ts, claude.ts, report.ts the runner that drives the lead (claude -p) and prints the report
harness_own_custom/core/.claude/mods/interrupt/  (the harness owns its .claude, system_prompt.md, agent_prompt.md; its tests, skip_test and report are in harness_own_custom/test/)
                               the mount: a Claude Code mod that answers the lead's Agent / SendMessage
                               calls from harness_own_custom. No real sub-agent starts, so we can
                               interrupt every call (<session>/run/mod_events.jsonl) and deny forbidden agents.
```
Default mode is the mod (`--plugin-dir .claude/mods/interrupt`). `--real` uses thin real Claude sub-agents instead
(the older path: real sessions, mocked work). The mod must return the Agent tool's full output shape
(`status: "completed"`, `prompt`, `agentId`, `content`, counters) or the engine rejects it.

## Interference points (`core/harness_own_custom/core/interface.ts`)
`IHarness` (spawn / send) is the whole public surface. `Interceptor` is where we step in: `onSpawn`, `onSend` (return
`{respond}`, `{script}` or `{deny}`; nothing = default fixture lookup) and `onEvent` (sees every event). The main flow
diagram and the four rules (R1-R4) are at the top of that file; `harness.test.ts` checks them offline.

## .state is a permanent cache (never deleted)
A case that already has a result is **not run again** (`CACHED`). `--rerun` runs it again and first archives the old result to
`.state/<version>/data/<ws>/cache/<id>.<n>/` (`.1`, `.2`, ... each rerun keeps one more). Sessions (`sessions/fx_<id>/`) and run records (`last/`) are kept so chained cases continue without re-running their predecessors. Do not delete `.state`. When the orchestrator changes, bump `STATE_VERSION` in `core/paths.ts`: the new version starts empty and the old one stays on disk.

## Run
```
bun core/run.ts test_basic --list
bun core/run.ts test_basic basic_1_write_hi          # one case
bun core/run.ts test_basic                           # all, in order (chained)
flags: --keep (keep run_test)  --raw (save the stream-json in <session>/run/raw.json)
```
A case with `after: "<id>"` restores that case's lead session (`--resume`), sub-agent ids and workspace, so
chains (1 -> 2 -> 3) and branches (1 -> 2B) never re-run earlier steps.

## How we interfere
- `PreToolUse` hook on `Agent|SendMessage` logs every call to `<session>/run/trace.jsonl` and **denies + stops** a forbidden agent.
- A sub-agent is a thin real Claude agent: it pipes its task to `core/interpose.ts mock <name>`, which finds a fixture
  by `keywords` (all must appear in the task) and writes its `files`. No match -> `NOTFOUND`, the case fails: that is
  the point where we add a fixture.
- Nothing is asserted by code. Each case has `expected: { context, expected_agents_res }` (plain text + the ids planned to respond: a recorded
  result id for a spawn, `session:<agent>#<n>` for a follow-up). `core/report.ts` prints EXPECTED next to ACTUAL (calls, new vs same session label,
  hand-over text, served result ids, files, sub-agent words, lead reply) and a human / Claude judges it. Session labels (`writer#1`) are saved in the checkpoint.

## Suites
- `test_basic`: 1 writer writes hi.md; same writer asked again (same session); reviewer (new session).
- `test_basic_2`: two writers, two separate tasks (a.md, b.md): new session for the new task, and each session
  remembers only its own task (`subReplyNotContains` catches leaks); 2 -> 3 and 2 -> 4 are branches.

- `test_handover` (9, from Test_agent_2 `test_1.json`): the lead forwards each question to ONE researcher with the question intact
  (the expected context says so), makes no follow-up and does no work itself; `expected_agents_res` names the recorded result that should answer
  (case 7 is a rephrase of 2: same result). Case 8 needs two calls.
- `test_pipedream` (12, from `test_2.json`): Slack structure/core/sources, how to create a component, create the GitHub "Lock Issue"
  action (the hand-over must carry the old action + guidance; the harness script copies the mock files into `run_test`), and 4 Claude Code mods cases.
- `test_workflows` (5, from the old `test_agent/cases`, 11 Loopferry real-task cases reduced to harness patterns; the product-specific ones
  (GitHub App, PR publishing, egress allow-list, docs generation) were left out): `wf_1` a read-only constraint reaches the sub-agent;
  `wf_2` (after 1) a follow-up that refers to a prior answer must carry it in the hand-over; `wf_3` plan -> approval gate -> build (2 turns);
  `wf_4` implement -> fresh reviewer -> fix with the findings; `wf_5` a failing sub-agent must be reported honestly.
- Recorded results are `TestCases/test_folders/agent_fixture/results/<id>.ts`: `{id,title,description,match?,expected_input:{text,guardrails_test},run(req)}`.
  `run(req)` does the work (`req.cp("lock-issue")` copies `TestCases/test_folders/agent_fixture/store/lock-issue` into the workspace, `req.write(path,text)`) and returns the reply
  text. There is no static response field. The harness picks one by `match.keywords` (all in the task) or by similarity of the task to `expected_input.text`
  (threshold 0.15), runs it, returns the text. `TestCases/test_folders/agent_fixture/index.json` lists id, file, keywords, text and what each copies, so a result is easy to find.
- `TestCases/test_folders/agent_fixture/store/`: `lock-issue` (mock output), `pd_src` (original Pipedream sources), `expo_examples`, `lsp_trap` (fixtures for later suites),
  `legacy/` (Test_agent_2's Python cases, guard rules, prompts and the 7 team-role results, kept until ported to TS then deleted). Skills are in `helper/skills`.
- Latest results (what passed, update time on top): `core/harness_own_custom/test/test_report.md` (refresh: `bun core/harness_own_custom/test/make_report.ts`); Loopferry's own: `core/loop_ferry_harness/test/test_report.md`.
- Harness approach, tree of supported/unsupported scenarios, weaknesses and `skip_test`: `core/harness_own_custom/README.md`.
- Loopferry's own `claude -p` session handling (does it continue and keep a session? how it works, what was tested, weaknesses): `core/loop_ferry_harness/README.md`; probes: `bun core/loop_ferry_harness/test/session_probe.ts` (real CLI, ~9 tiny calls) and `test/rules_probe.ts` (no cost).
- Docs: `docs/sources.md` (where the test data comes from, unverified), `docs/expo_team_design.md` (Expo chain design).
- `test_expo_proj_planning` (1), `test_expo_sub_agent` (3), `test_expo_direct_build` (2): the Expo team (planner -> ux-designer -> builder -> qa-reviewer) with the role-order guard (`core/harness_own_custom/core/guard.ts`, rules `TestCases/test_folders/agent_fixture/store/expo_rules.json`, lead protocol `core/prompts/lead_team.md`); a case sets `guard`, `lead` and per-turn `allowed`.
- `test_solowork` (4, tag `SoLoWork`): the lead works ALONE (`router: false`, `lead: "solo"`) and follows confirm-first: show the content, wait for the OK, then write (or apply the user's change, or write nothing on cancel). Runs in an `external` workspace (`~/.cache/test_agent_3/run_ws`) because Claude Code refuses Write/Edit under `.idea/`.
- `test_artifact` (5, tag `Artifact`: website, explanation, figma, working website, planning/flow): all FAILED, the `Artifact` tool does not exist in headless `claude -p` (`core/harness_own_custom/test/artifact_probe.ts`).
- **Tags**: a case has `tags: [...]` and a suite has `export const tags`; both show in the run output (`## id: title [tags]`) and in the report's Tags column.
- **DB cases** (Loopferry's own dev database, read-only): `core/loop_ferry_harness/test/db_replay.ts` (needs `DATABASE_URL`, e.g. the repo's `.env`).
- Still to port (sources are in `TestCases/test_folders/agent_fixture/store/legacy`): LSP cases, skills case.

## Findings (harness)
- The lead must be told which agent types exist and that answers are final, or it picks built-ins (`Explore`, `general-purpose`)
  or sends "verify / go deeper" follow-ups. The harness now owns that in `system_prompt.md` and the mod refuses unknown types
  (`GUARD-RETRY`, not counted as a call) and hard-stops forbidden ones (`GUARD`).
- Mock results must look like normal work (tool count > 0) or the lead distrusts them.

## Findings (test_basic, `--real` mode)
- The sub-agent id comes back as `agentId: <id>` in the Agent result; continuing it is `SendMessage {to: <id>}`.
- `SendMessage` is **async** in `-p`: the lead's tool result is only "Resuming agent ..."; the answer arrives in the
  resumed sub-agent's own turn. So judge the sub-agent's own text, not the lead's reply.
- A resumed sub-agent remembers what it ran (session persists); a different agent type gets a new id and no memory.
- Cost: about $0.004 to $0.006 per case with haiku.

## Add a case
Append to `cases` in `test_case/<suite>/main.ts`; add a fixture if the sub-agent needs a recorded answer.

## Catalog of findings
Issues, causes, fixes and the owner's points from the real runs: `RUN_FINDINGS.md` (index of all docs: `INDEX.md`; open work: `../TestCases/test_folders/TODO.md`).
