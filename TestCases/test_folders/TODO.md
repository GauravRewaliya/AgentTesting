# TODO: failed cases and remaining work (test_folders)

Keep this list current: add a row when a case fails or a weakness is found, move it to DONE (with the date) when fixed. The architecture progress and the bug catalog live in
`test_harness/core/orchistraitor/f1_multiagent/PROGRESS.md`.

## OPEN

| id | case / area | what is wrong | next step |
|---|---|---|---|
| T-01 | every case (judge) | WRONG PASS: the judge only checks WHO was called (`testrun/cases.ts judgeTurn`). A right call list with a wrong or confused final answer to the user still shows PASS (`eg_tw_rework_notailwind`, 2026-11-12: lead said "not finished" after the fix was applied). | add an optional `Expected.reply_must` / `reply_forbid` (word lists, cheap, no model) and fill it for rework cases; later an LLM-judge pass on the final reply. |
| T-02 | `eg_tw_rework_notailwind` | the haiku lead keeps re-verifying after the fix (up to 2 extra asks) and sometimes ends with a hesitant reply. Observer block run 2026-11-12: order right, still FAILED (lead asked 2 more verify asks, wanted quoted export lines the observer does not carry). | re-run 3x with a fresh store each, count passes; if flaky, tell the lead in its prompt: "the harness OBSERVER block is the evidence, one check is enough". |
| T-03 | `eg_lintab_02_rework` | never run for real (only fixtures checked locally). Its fix reply has no on-disk proof lines like the tailwind one. | run it; add "VERIFIED ON DISK" lines to its `_fix` result. |
| T-04 | lead prompt (`harness/agents/lead`) | **most valuable next step.** The lead has no file tools: it can only judge a sub-agent by text. Verify asks go back to the fixture agent and eat the call budget. | do it: give the lead a read-only `tools.ts observe <dir>` (list + excerpts) so it never has to ask. |
| T-05 | f1 runs | 2 of 6 real runs never reached the sub-agent: the lead's Bash call was DENIED ("don't ask" permission mode). Run is wasted money. | find which permission rule / mode makes `tools.ts` calls ask; pass the allowlist in the runner settings. |
| T-06 | `testrun/run.ts --rerun` | rerun with the default store re-used the old task id for gate counting, so earlier calls counted against `max_agent_calls` (a clean run failed with "call 4 over limit"). Workaround: `UI_STORE=<dir>/store.json UI_REPO=<dir>/repo`. | make `--rerun` always create a new task id AND a fresh `fixture.*` event scope. |
| T-07 | fixtures keywords | keyword lookup is brittle: a lead that rephrases misses it (NOTFOUND -> corrected -> wasted call). `tailwind app` did. | prefer one distinctive folder name per case (`tw-rework`); consider also matching on the case id passed by the harness. |
| T-08 | older chains (31 cases) | still `after`-chained workspace dependence; fixtures only work in order. | optional: standalone start-state fixtures. |
| T-09 | `max_agent_calls` | counts extra (verify) calls, so a careful lead is punished. | separate budget: real calls vs verify asks (1-2 allowed). |

| T-10 | `fixture_sessions` | only tested with a direct script (4 calls), NOT yet with a real lead run; the `ui/` console does not show the table yet; a verify ask while the bad answer is the latest still matches the `after` fix (keywords equal) and serves it. | real run of both rework cases; add a table view to the console; maybe a `verify` intent word list so "check" never serves the fix. |

| T-11 | `allow_real_subAg` real path | tested only with a stub runner; no case actually uses a fixture agent + allow_real_subAg yet (the 3 suites that carry the flag have no fixture agents). | add one real example (expo-go, a task with no recorded result) and run it once; check the table row is `real` and the session id reaches `claude --session-id`. |
| T-13 | `isVerifyAsk` | word-list heuristic: a mixed ask ("check and also add X") counts as new work; a check phrased without the listed words counts as new work too (-> real call / FIXTURE NOT FOUND). | watch real runs; extend the lists or let the lead mark it (`--intent check`). |
| T-12 | "FIXTURE NOT FOUND" strictness | keywords the lead rephrases = instant fail (before: one retry). | consider matching by case id passed from the harness instead of free text. |

## DONE

| date | what |
|---|---|
| 2026-11-12 | `test_expo_go` rewritten as plain cases (no `phased/followUp/byModule` generators); shared base `lib/shared.ts`. |
| 2026-11-12 | rework cases `eg_tw_rework_notailwind`, `eg_lintab_02_rework` with a bad + `_fix` fixture each (`test_expo_go/rework.ts`). |
| 2026-11-12 | `match.after` on a fixture: served only after another result was served (deterministic bad -> fix order). |
| 2026-11-12 | judge counts each served result once; resume vs new does not matter for served fixtures. |
| 2026-11-12 | `no_fixture` -> `allow_real_subAg` (real call only when the case allows it, else "FIXTURE NOT FOUND"); gate flow session -> fixture -> real/error |
| 2026-11-12 | `fixture_sessions` table: fixture session state/version/history per master task, follow-ups continue the session (tested directly, no real run yet) |
| 2026-11-12 | gate OBSERVER: every served reply and every verify ask carries the real change list + first lines of changed files. |
