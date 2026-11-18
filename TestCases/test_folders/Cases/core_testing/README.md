# core_testing

Cases for the harness CORE: the pitfalls of `ProgressAndFound.md` (section "Test Cases", +ve = must happen, -ve = must be caught). Mocked sub-agents (recorded fixtures); only the lead is a real call. What each suite is for: `index.ts` in this folder (route lines).

This is the map from the catalog areas to what exists. A new core case goes into the suite of its area; an area with no suite yet gets a new folder + one route line in `index.ts`.

| Catalog area (ProgressAndFound.md) | Suite today | Notes |
|---|---|---|
| Calling agents (same agent again, new role = new session, refused calls) | `test_basic`, `test_basic_2` | refused / unlisted agents: `self_test/multi.ts` (free, not a case) |
| Parallel work and same-file conflict (locks, patches, forks started together) | none | harness-level: `self_test/multi.ts` |
| Hand-over and context (what AND why, constraints, follow-ups) | `test_handover`, `test_workflows`, `advance_test` (adv_3 context reaches the reviewer) | |
| Planning (plan, approval gate, plan stands alone) | `test_workflows` (wf_3); big plans: `real_usecases/test_prompt_planning` | |
| Builder (scope, no extras, checks before reporting) | `Cases/subagents/builder` | the sub-agent itself |
| QA (real check, exact error back, re-run after every fix, loop stops) | `advance_test` (adv_1 fresh reviewer finds gaps, adv_2 approves then stop, adv_4 QA video), `Cases/subagents/qa_reviewer` | the old qa_check repair-loop cases (adv_5, adv_6*) were removed ON PURPOSE with the `qa_check` mechanism (RUN_FINDINGS H20); what replaces their intent: TODO T-24 |
| Right size of the work | `real_usecases/test_expo_direct_build` | small asks answered without a sub-agent |
| The person stays in control (pause, stop, correct, status) | none | needs the slash-command / inbox flow; `self_test/multi.ts` |
| Safety, Retry, Blocked task (stop, do not improvise) | `test_workflows` (wf_5 honest failure); `Cases/subagents/builder` (`NEEDS_PARENT`) | |
| Browser and look-up | `advance_test` (adv_4 QA video) | `lookup` has no sub-agent suite yet (TODO T-23) |
| Sandbox and package manager | `Cases/subagents/builder` (`sb_pnpm_only_script`) | |
| Stuck and background jobs | none | `self_test`; hung-call watchdog TODO 7.e |
| Report and cost | none | |
| Start of the master | none | |

"none" = no case-based suite yet (the area is covered, if at all, by the free `self_test/` scripts). Do not move a case here just because it has a lead: `real_usecases` and `subagents` are for real projects and for the sub-agent itself.
