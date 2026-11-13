# f1_multiagent: progress catalog and bug report

Update this file with every change to the harness or to how cases are judged. Open work on the TEST CASES is in `TestCases/test_folders/TODO.md`.

## Architecture in one picture (as it is today)
```
user -> LEAD (haiku, no file tools, only `tools.ts`) -> tools.ts spawn/send/wait/ledger_get/apply_patches
                                                          |
                          sub-agent with "fixtures": true -> FixtureGate (session table -> fixture -> allow_real_subAg ? stateless real call with history : FIXTURE NOT FOUND) (harness/core/fixture_gate.ts)
                                                          1 guard  (store/*_rules.json: names run_test + PLAN.md, min length)
                                                          2 lookup (pickRecorded: keywords, most keywords wins, `match.after` = only after another result was served)
                                                          3 serve  (result.run(): copies/patches files into run_test/, NO model call, NO `claude -p`, NO --session-id)
                                                          4 OBSERVER (new) compares run_test/ before/after and adds the real change list to the reply
                                                          5 limit  (max_agent_calls; "extra" = repeat/verify ask, answered from the observer, no new work)
judge (testrun/cases.ts): WHO was called (served results) vs expected_agents_res; the final reply is only read by a person
```
Fixture session table (`MStore.fixtureSessions`): `{session_id, task_id, master_agent, master_session, role, workspace(shared run_test), version, state open|served|verified, served[], history[{v,kind,result,prompt,reply}]}`.
A verify ask to the same sub-agent (`--session <agent_id>`, what the lead's CLAUDE.md demands for "check with <agent>") reaches the same gate: it is answered by the gate itself (observer), not by a real session.

## DONE
- 2026-11-13 PROTOTYPE STARTER KIT (target: a clickable prototype link in 4 minutes). `harness/kits/proto/{kit.css,kit.js}` = corporate design system + app shell (sidebar, header, hash router, toast, `ui-modal`, `ui-drawer`, `ui-badge`, `ui-icon`, `ui-empty`). `tools.ts proto_init --dir run_test/<p> --title .. --nav "A, B, Group>C"` (`core/proto_init.ts`, no model call, ~10 ms) copies the kit and writes a WORKING shell + one stub screen per nav item + `js/screens/<group>.js` + `css/pages-<group>.css` + `proto.json` + `PROTO.md` (contract, class list, example). The lead then forks ONE builder per screens file (`fork_all`, no base builder needed) and builders only write screens. `preview` now opens EVERY route in headless Chrome in parallel (`smokeRoutes`, ~3 s) and reports stubs (TODO), undefined/NaN/[object Object], empty tables, JS errors: the lead hands that list to the owning builder (`preview_gate`, same 3-strikes loop as `qa_check`). `checkPage` skips the ~10 s WebGPU probe unless the page has a canvas (page check 0.8 s). Writers called without `--writes` default to the `run_test/<project>` named in the objective (was: a failed first Write and a second call). `self_test` suite `protokit` (PK1-PK6) + case `real_proto_fast_path`; NP1 updated (the planner may call ux-designer/builder).
- 2026-11-13 Slow prototype runs (session smwex2xnw: 77 min, $2.4, 25 calls for a clickable admin mockup). Causes found in its log: (1) researcher + planner + ux-designer ran BEFORE any build (~15 min, plus 3 "NOT DECLARED" / Bash-denied round trips); (2) the lead's "ask generator options" rule made a Vite + TS + Pinia + ESLint project (builder#1 wrote 84 files, builder#2 spent 20 min on pnpm release-age); (3) the lock lease was 2 min, a long silent Write expired it and a 4 min retry followed (now 20 min); (4) builders were `delegate`d one after another (not parallel), and a v2 restyle resumed old heavy builders ($0.49 for one call); (5) the lead prompt still said "killed after 10 minutes". Fix: lead PROTOTYPE FAST PATH (builder first, no planner/ux/research first, single `index.html` up to ~6 screens like a Claude artifact, forks only above that, 10 min to the first preview, stop+split a stalled builder), builder SINGLE-FILE mode and an honest tool list (the "node/bun refused by the write guard" claim was wrong), `proto_check` understands inline `<script>`/`<style>` and `app.component(...)`.
| date | what | where |
|---|---|---|
| 2026-11-13 | PROMPTS: stage-planner writes a PLAN.md contract (REQUEST, SCOPE/non-goals, FILES, STEPS, RISKS, ACCEPTANCE, OPEN QUESTIONS, scaled to the request); stage-builder: request wins over the plan, tiny jobs = one check; stage-reviewer: judges against the person's request (asks NEEDS_PARENT if not told), reviews only the change, never lists remove/revert for what was asked, severity per finding. LEAD: scale work to the request (a copy is ONE builder, no pipeline), a reviewer always gets request + follow-ups + what changed + limit, a finding that would undo requested work goes to the person not a builder, read-only agents get no `--writes`. Source: loopferry TASK_RUN_REPORT (a `cp` cost $1.81 and a reviewer made the fixer delete the requested file) | `harness/agents/{lead,stage-*}/.claude/CLAUDE.md` |
| 2026-11-13 | per-case COST CAP: `Case.max_cost_usd` or env `HARNESS_CASE_CAP_USD` (default $1); a real run over it fails with a `COST CAP` gate (not applied to --fake) | `TestCases/types.ts`, `testrun/run.ts` |
| 2026-11-13 | `.gitignore`: agent `.claude/CLAUDE.md` + `settings.json` are now trackable (they were silently ignored by `.*/`; vendored `skills/` stay out) | `.gitignore` |
| 2026-11-13 | LIVE (haiku lead, fixtures): adv_3 PASS $0.0082 (lead carried the request to the reviewer), adv_2 PASS $0.0105, adv_1 PASS $0.033 | `.state/v1/` |
| 2026-11-12 | `testrun/par.ts`: independent chains of a suite run in parallel (own process, task, store, workspace); `HARNESS_MAX_LEADS` (default 1) lifts the machine-wide lead slot; the case-to-task index is one file per case (`.state/v1/f1_exp/`), no lost updates. Verified with `--fake`: 33 cases in 7 chains, 33 index files, no container left. NOT run live yet | `testrun/par.ts`, `testrun/run.ts`, `harness/core/base/runner.ts` |
| 2026-11-12 | `Case.qa(req)` declaration and `--video` obeying it; DockerRunner + compose service `sandbox` + image with Claude Code (see docs/SANDBOX.md) | `TestCases/types.ts`, `helper/video.ts`, `docker_runner.ts`, `infra/docker-compose.yml` |
| 2026-11-12 | extra flag `--video` (external helper `orchistraitor/helper/video.ts`): QA video after a case; web page only, native Expo says so | `testrun/run.ts`, `helper/video.ts` |
| 2026-11-12 | the runner SEEDS the starting state (`bases/<name>` -> `run_test/<dir>`) for cases that promise it, before the lead starts | `testrun/run.ts seedStart` |
| 2026-11-12 | layout per master session: `.state/v1/<task>/store/` (store.json, .board, record/, qa/) and `.state/v1/<task>/workspace/` (git workspace); old shared `ui/.ui-data` store/repo only with `UI_STORE`/`UI_REPO`; session record always written locally, S3 opt-in; QA video goes to the session's store/qa | `testrun/run.ts`, `infra/record_session.ts`, `store/advance/stages.ts` |
| 2026-11-12 | browser QA with a REAL video: sub-agent `stage-qa`, fixture `adv-qa-video`, case `adv_4_qa_video`; recorder in a throwaway Docker container (no network, read-only app mount, only `.state/qa/` writable); `QA_SANDBOX=docker\|off\|e2b` (e2b not implemented on purpose) | `test_harness/infra/qa/*`, `agents/stage-qa`, `store/advance/stages.ts`, `advance_test/verify.ts` |
| 2026-11-12 | session recording to S3 is OFF by default (`AT_RECORD=1` to turn on) | `infra/record_session.ts` |
| 2026-11-12 | lead got READ-ONLY `ls` / `read_file` / `grep` jailed to run_test/ (T-04): real run `eg_tw_rework_notailwind` PASS with 0 verify asks, lead reply confident | `harness/core/workspace_read.ts`, `harness/tools.ts`, lead CLAUDE.md/settings.json, `harness/lead.ts` |
| 2026-11-12 | S3Mock (loopferry's emulator) + record session upload after every case (summary, events with seq, fixture_sessions, calls, workspace) | `test_harness/infra/*`, `testrun/run.ts` |
| 2026-11-12 | `advance_test` suite: stage-planner/builder/reviewer fixtures, `match.after` across agents, deterministic reviewer that reads the real files; adv_1 + adv_2 PASS live, adv_3 (context loss, loopferry 5.20) fixture-verified only | `TestCases/test_folders/advance_test/`, `agent_fixture/store/advance/stages.ts` |
| 2026-11-12 | isolation: a case without `after` starts with an empty run_test/ | `testrun/run.ts` |
| 2026-11-12 | mocked agents are not "rolled / lost session" any more; judge counts an expected `session:` follow-up answered from the table; pickRecorded prefers a not-yet-served result | `base/call.ts`, `testrun/cases.ts`, `harness_own_custom/main.ts` |
| 2026-11-12 | NP3 (every agent prompt has the stuck rule) fixed for expo-go + new stage agents: self_test/multi 169/169 | `harness/agents/*/.claude/CLAUDE.md` |
| 2026-11-12 | `fixture_sessions` keyed by (task, AGENT id) not claude session id: a mocked agent has no transcript, so the harness rolled a new claude id on every call and each call became its own row | `fixture_sessions.ts findSession` |
| 2026-11-12 | verify asks answered from the table are free (separate budget `MAX_VERIFY` = 3), `max_agent_calls` counts only served/corrected/real calls | `fixture_gate.ts charge()` |
| 2026-11-12 | `isVerifyAsk`: NEW work only when the ask STARTS with a work verb; any other ask with a check word is a check | `fixture_sessions.ts` |
| 2026-11-12 | `pickRecorded(..., strict)`: the gate's similarity fallback only uses results that declare the agent | `harness_own_custom/main.ts`, `fixture_gate.ts` |
| 2026-11-12 | `no_fixture` renamed `allow_real_subAg` everywhere (types, validate, policy, suites, docs); meaning: a call with NO fixture may go to the REAL sub-agent (with --session-id), otherwise the gate raises "FIXTURE NOT FOUND" and the case fails | `TestCases/types.ts`, `fixture_gate.ts`, `testrun/cases.ts declareGateLimit` (writes event `fixture.allow_real`) |
| 2026-11-12 | REAL calls are ONE-SHOT: `RunCall.stateless` -> `claude -p ... --no-session-persistence` (no --session-id, no --resume, no session file wasted). The real agent's memory is the `fixture_sessions` history (earlier fixture AND real turns + files on disk) put into its prompt (`historyForReal`) | `base/types.ts`, `base/runner.ts`, `fixture_sessions.ts`, `fixture_gate.ts` |
| 2026-11-12 | a known session + an ask with no fixture: a CHECK ask (`isVerifyAsk`) is answered from the table, NEW work goes to step 3 (real call if allowed, else FIXTURE NOT FOUND) | `fixture_sessions.ts`, `fixture_gate.ts` |
| 2026-11-12 | gate flow: 1 session table 2 prompt+fixture 3 allow_real_subAg ? real : error. Real sessions are recorded (state `real`), so their follow-ups stay real. Tested directly (A/B/C scenarios) | `fixture_gate.ts` |
| 2026-11-12 | `match.after`: a result is only eligible after another one was served (bad -> fix order independent of wording) | `harness_own_custom/main.ts pickRecorded`, `agent_fixture/types.ts` |
| 2026-11-12 | most specific keyword match wins | `pickRecorded` |
| 2026-11-12 | judge counts each served result once; new vs resume irrelevant for served fixtures | `testrun/cases.ts judgeTurn` |
| 2026-11-12 | gate message no longer says "Phase n of N" for every case | `fixture_gate.ts` |
| 2026-11-12 | OBSERVER: real change list (+ first lines of 3 small code files) appended to every served reply; short one-line version at the FRONT because `wait` shows only 600 chars | `fixture_gate.ts observe / observeHead` |
| 2026-11-12 | verify ask ("already done") now returns the earlier answer + files on disk now | `fixture_gate.ts` |
| 2026-11-12 | table `fixture_sessions` (master task -> fixture session id -> state, version, served, history, shared workspace); a follow-up with the same session id continues that fixture session; a verify ask with no keywords is answered from the table instead of refused | `harness/core/fixture_sessions.ts`, `board.ts` (persisted in `<store>.board`), `fixture_gate.ts` |

## BUGS / LOOPHOLES FOUND (status)
| id | bug | effect | status |
|---|---|---|---|
| B-01 | judge is WHO-only: right calls + wrong final answer = PASS ("wrong pass", see `rework.ts` L21-L23 note) | false green | PARTLY FIXED: `reply_must` / `reply_forbid` (word lists, `replyProblem`) exist; only cases that declare them are checked (adv_2 does). Still OPEN: most cases declare none, and adv_1 passes while the lead's reply says the review "did not complete" |
| B-02 | lead cannot read files, so it can only trust or re-ask a sub-agent; the fixture's own reply may be incomplete (that is the point of rework cases) | lead re-verifies 2x, hesitant final answer | MITIGATED by observer; lead tool still OPEN (T-04) |
| B-03 | `wait` returns only 600 chars of an answer; anything important at the end of a reply is invisible (`truncated:true`, needs `ledger_get --report`) | evidence cut | FIXED for the gate (observer line first); general rule OPEN: long replies should lead with the verdict |
| B-04 | verify ask got the canned "ALREADY DONE ... same answer" (no new information) | lead distrust loop | FIXED (observer + disk listing) |
| B-05 | keyword lookup brittle (`tailwind app`, `missing`) | NOTFOUND / wrong result served | FIXED for rework (distinct folder + `after`); general OPEN (T-07) |
| B-06 | fix and chain cases shared a folder name (`tw-app`) so the lead's hand-over matched the wrong fixture (`eg_tw_01`) | wrong fixture served | FIXED (`tw-rework`) |
| B-07 | `--rerun` on the default store re-used the old task id; old gate calls counted toward `max_agent_calls` | clean run failed "call 4 over limit" | OPEN workaround: `UI_STORE=... UI_REPO=...` (T-06) |
| B-08 | lead's Bash (`tools.ts`) denied by the permission mode in 2 of 6 real runs | run wasted, nothing served | OPEN (T-05) |
| B-09 | `max_agent_calls` counts verify asks as calls | careful lead fails | OPEN (T-09) |
| B-11 | a verify/"what did you do" follow-up had to repeat the case keywords + PLAN.md or it was refused (wasted call) | wasted calls | FIXED (known session + nothing new to run -> answered from the table) |
| B-12 | no fixture used to be "NOT ACCEPTED, retry" (wasted calls, hidden brittle keywords); now a hard error unless allow_real_subAg | FIXED (stricter: a lead that rephrases and misses the keywords now fails at once, see TODO T-07) |
| B-13 | a known session + unmatched ask was always "verify" even for NEW work (hid FIXTURE NOT FOUND, never reached the real call) | FIXED (isVerifyAsk heuristic; word lists, no model) |
| B-14 | table was keyed by claude session id, which is rolled every call for a mocked agent -> "same session" never happened in real runs | FIXED (key = agent id) |
| B-15 | similarity fallback offered 15 agent-less results of other suites to `expo-go`: a lead retry was served `pd-slack-source` (Pipedream) | FIXED (strict agent match in the gate) |
| B-16 | the lead asks the sub-agent to RUN commands (`grep -rn ...`, `tsc`) and paste output; a mock cannot, so FIXTURE NOT FOUND (correct) and the case fails | OPEN: T-04 (lead read tool) or `allow_real_subAg` on the case |
| B-17 | cases shared one workspace; once the lead could `ls`, adv_1's files misled adv_2 (fixtures of the other case were served inside it) | FIXED (empty run_test/ per non-chained case) |
| B-18 | `match.after` only saw results of the SAME agent; a stage chain needs the planner's result for the builder | FIXED (task-wide) |
| B-19 | a check question to a second agent of the same role got FIXTURE NOT FOUND | FIXED (history of the role counts) |
| B-20 | cases said "the fixture is set up in run_test/<dir> for you" but only the sub-agent's run created it; with the new `ls` tool the lead checked, found nothing and called no sub-agent (eg_solarin_01 FAIL, 13 s) | FIXED (runner seeds it); a real PASS follows |
| B-21 | the runner printed `cost so far=$0.0000` for every real run | FIXED: run.ts reads the lead's `total_cost_usd` (+ real sub-agents); verified 2026-11-13 ($0.0082 for adv_3) |
| B-10 | lead CLAUDE.md: "check with <agent>" must continue the agent; with a fixture agent that returns canned text | encourages repeated asks | MITIGATED by observer |

## How to make it stronger (ideas, in order of value)
1. Assert the final reply (word lists first, LLM judge later) -> kills B-01.
2. Lead gets a read-only `observe <dir>` command (same code as the gate observer) so verifying never costs a sub-agent call -> B-02, B-09.
3. Real writers already return a PATCH (`apply_patches`); give fixture agents a patch too (the observer diff is the same thing), so the lead path is identical for real and mocked agents.
4. A rework result should state its own gaps in a machine-readable `REPORT.gaps[]` that a strict lead can compare with the user's list.
5. Separate budgets: real calls vs verify asks.
6. Every run gets its own store/task (fixes B-07 for good).

## Run log (real, haiku lead only)

- 2026-11-13 `real_proto_fast_path` (8-screen admin mockup, haiku, docker): lead ran `proto_init`, started 2 builders at once, previewed: link at 3 min 10 s, $0.056, 8/8 routes clean (was 77 min, $2.44, 25 calls in smwex2xnw). Details: `docs/PROTOTYPE_KIT.md`.
| date | case | result | note |
|---|---|---|---|
| 2026-11-12 | `eg_tw_rework_notailwind` x6 | 1 PASS (wrong-pass flavour), 3 FAIL (lead over-verified / contaminated store), 2 no-run (Bash denied) | before the observer |
| 2026-11-12 | after the table/budget/strict fixes: `eg_tw_rework_notailwind` PASS (bad, fix, 2 free verifies; table row v4), `eg_lintab_01_4da28ef` PASS, `eg_lintab_02_rework` PASS once and FAIL once (bad, fix, 2 verifies, then the lead asked the agent to run grep/tsc -> FIXTURE NOT FOUND). 2 more runs never started (lead's Bash denied, B-08) | |
| 2026-11-12 | `eg_tw_rework_notailwind` x1 (with observer) | FAIL | order right (bad -> fix served), but the lead asked for "quote the export lines of src/tw/*.tsx" 2 more times (verify asks it can only send to the sub-agent), 5th call over the limit of 4. Its final reply DID cite the harness observer ("the harness saw these files change") = grounded, but hesitant. Conclusion: the observer helps, the real fix is T-04 (lead gets a read-only observe/read command). |
| 2026-11-12 | `test_basic_2` (4 cases, parallel runner) | **4/4 PASS in 37 s** | mocked `writer` (fixtures: true on writer/reviewer), lead cost about $0.002 per case |
| 2026-11-12 | `advance_test` (4 cases, parallel, `--video`) | **3/4 PASS in 58 s**; adv_3 FAILS by design (first review hand-over lacks the intent) | adv_4 took a real video |
| 2026-11-12 | first attempt of those two suites | 2/4 + 3/4, then 0/4 + 2/4 | three harness bugs found and fixed: final reply judged before it was filled in; cases promising a file that nothing created (`Case.seed`); a branch case started from an empty session; a "fresh" run reused an old session folder |
