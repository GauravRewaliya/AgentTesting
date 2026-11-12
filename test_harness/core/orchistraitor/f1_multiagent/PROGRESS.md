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
| date | what | where |
|---|---|---|
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
| B-01 | judge is WHO-only: right calls + wrong final answer = PASS ("wrong pass", see `rework.ts` L21-L23 note) | false green | OPEN (TODO T-01) |
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
| B-10 | lead CLAUDE.md: "check with <agent>" must continue the agent; with a fixture agent that returns canned text | encourages repeated asks | MITIGATED by observer |

## How to make it stronger (ideas, in order of value)
1. Assert the final reply (word lists first, LLM judge later) -> kills B-01.
2. Lead gets a read-only `observe <dir>` command (same code as the gate observer) so verifying never costs a sub-agent call -> B-02, B-09.
3. Real writers already return a PATCH (`apply_patches`); give fixture agents a patch too (the observer diff is the same thing), so the lead path is identical for real and mocked agents.
4. A rework result should state its own gaps in a machine-readable `REPORT.gaps[]` that a strict lead can compare with the user's list.
5. Separate budgets: real calls vs verify asks.
6. Every run gets its own store/task (fixes B-07 for good).

## Run log (real, haiku lead only)
| date | case | result | note |
|---|---|---|---|
| 2026-11-12 | `eg_tw_rework_notailwind` x6 | 1 PASS (wrong-pass flavour), 3 FAIL (lead over-verified / contaminated store), 2 no-run (Bash denied) | before the observer |
| 2026-11-12 | `eg_tw_rework_notailwind` x1 (with observer) | FAIL | order right (bad -> fix served), but the lead asked for "quote the export lines of src/tw/*.tsx" 2 more times (verify asks it can only send to the sub-agent), 5th call over the limit of 4. Its final reply DID cite the harness observer ("the harness saw these files change") = grounded, but hesitant. Conclusion: the observer helps, the real fix is T-04 (lead gets a read-only observe/read command). |
