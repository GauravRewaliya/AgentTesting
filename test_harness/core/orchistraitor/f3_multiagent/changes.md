# changes.md: what to correct, all at once, when f3 is built

Written 2026-11-18. **Plan and report only: no code, no test case and no TODO.md line was changed for this file.** Everything below is checked against the repo as it is today (git history, docs, code, free tests). Nothing was run.

How to read it
- Status words: `PLAN` (decided in words, nothing coded), `LATER` (the person said: not now), `DECIDE` (needs an answer, see section 6).
- When the building starts: write the code, **do not run the tests**, and mark every new or changed piece `// NOT_TESTED: <what is missing>` (same family as `// TODO:`, `// ERROR:`, `// NOT_POSSIBLE:` in `README.md`). A later pass runs them and removes the marker.
- Test cases are never deleted (`CLAUDE.md`). Recorded fixtures of removed cases stay.
- Where it lands in `docs/08_MIGRATION_STEPS.md`: sections 2 and 4 go into step 2 (copy the core) and step 4 (the `multi.ts` gate); section 3 is cases and fixtures (outside f3 core); section 5 is a cleanup pass done while the files are copied.

---

## 1. The principle: the new QA agent must own everything the old QA loop did

The old loop (`qa_check`, `qa_give_up`, `qa_record`, `core/qa_loop.ts`, the four `advance_test` cases, flags `expect_qa` / `no_qa_check` / `reset_qa`) was removed on purpose on 2026-11-17 (`docs/RUN_FINDINGS.md` H20; commit f551fce, whose message does not mention it). QA is now ONE agent, `qa-reviewer`. What matters is that each old behaviour has a new owner AND a test.

| Old behaviour | New owner today | Tested today? | Item |
|---|---|---|---|
| find a broken app early (type check, dev server, page errors, dev-server log; ~16 s) | the qa-reviewer's quick check (shell + `bg_start` + `browse`), about 2 min, sonnet | no | A1, A3 |
| builder says Done, the app is broken: exact error goes back, fix, check again | QA says FAIL + `NEEDS_CHANGES`, the lead hands it to a builder, asks QA again (`chapters/qa.md`) | only half: `expo_s2_build` (lead reports a QA FAIL honestly); no fix round | A3 |
| the same issue comes back (old: 3-strike stop in the tool) | prompt rule only: "after two fixes change the approach or tell the person; do not loop" (`chapters/qa.md`) | no | A3 |
| give up honestly, test marked failed (`qa_give_up`, `expect_qa`) | the lead ends with an honest "failed, here is what blocks it"; judged by `reply_must` / `reply_forbid` (TODO T-01) | no | A3 |
| QA must not start when nothing was built | harness refuses unless `--user-asked` | not found in `multi.ts` (to check) | A1 |
| one checkpoint commit per attempt | nothing: QA works in a throwaway copy, builders hand back patches | n/a | D3 |
| evidence: video, pictures, report | `tab open` / `tab do`, ONE `session.webm`, 16:9, `qa_video` / `qa_images` switches (commits c618191 to 23ca179) | **no free test at all** (0 hits for tab / session.webm / qa_images / headless.json in `multi.ts`) | A1 |
| throwaway copy, one QA per task, project memory in `.loopsAI` | harness | yes: `multi.ts` CX22 to CX26, CX28 to CX30, CX34, CX36 (free) | done |

The biggest hole is the last-but-one row: five commits of browser and video code that nobody tests.

---

## 2. A. The QA agent and its tools: how they get tested

Layers, cheapest first. "QA agent" = the real `qa-reviewer`; "tools" = `tab`, `browse`, `bg_*`, `.loopsAI`, the video encoder. The qa-reviewer stays on sonnet (model policy: haiku is allowed only for builder, researcher, writer, package-researcher, `docs/POINTS.md` #6), so the cheap part is the free layer and a cheap JUDGE, not a cheaper QA.

| # | Layer | What | Cost | Status |
|---|---|---|---|---|
| A1 | L0 free tool tests | new `self_test/qa_tools.ts` (or a section of `multi.ts`): a fake page from a local http server; skipped with a warning when there is no Chrome or ffmpeg (like PK11) | none | PLAN |
| A2 | L1 the QA agent alone | more cases in `Cases/subagents/qa_reviewer` (3 exist) | real sonnet, capped | PLAN, LATER to run |
| A3 | L2 the lead around QA | loop cases on the NEW design, QA answered by recorded results | lead only (haiku) | PLAN |
| A4 | L3 a real negative app | Solarin, section 3 | real QA in Docker | PLAN |
| A5 | L4 optional | the QA agent checks the harness's own UI; a haiku judge reads QA's answer against `must` (TODO T-01) | small | LATER |

**A1, what the free tool tests must pin (all code that has none today):**
- `tab`: `open` reuses an open tab; `do` runs a whole script on the same tab with no reload; `status`; `close`; the last close ends the headless Chrome; the registry `.state/headless.json`; a tab per agent.
- `--clear` is honoured once per folder per tab session.
- ONE `session.webm` per folder: a second script is appended, step numbers continue, each report row links to its own video segment, idle gaps are capped (6 s).
- frames are 1280x720 (16:9) in the kept-open tab.
- `qa_video` / `qa_images` switches: pictures OFF saves no picture; video OFF refuses `--video`; the old `qa_check:false` still turns video off (see R1).
- the `viewport` step and the `layout` finding in every snapshot (a page that scrolls sideways is listed).
- snapshot refs `@eN` can be targeted by a later script.
- the harness refuses to start QA when nothing was built unless `--user-asked`; a second QA call continues the one QA (CX28 exists, keep it).
- Why they were skipped: they need Chrome and ffmpeg. The PK tests already show the pattern (skip with a warning).

**A2, new qa_reviewer cases (real, capped, run later):** `sq_layout_overflow` (a page that scrolls sideways at 390 px: reported as a finding with the element), `sq_pictures_off` (honours "pictures OFF": judged from the snapshot, no picture asked for), `sq_not_checked_carries_over` (two turns: the second call starts at the first one's NOT CHECKED), `sq_quick_by_default` (does not click every corner when only a quick check was asked).

**A3, the lead loop cases (new design).** Reuse the orphan fixtures `adv-broken-build/fix` and `adv-stuck-build/fix` (builder answers, kept on purpose) plus NEW recorded qa-reviewer answers (FAIL with a `NEEDS_CHANGES` that carries the exact TS error; then PASS). Cases, in `Cases/core_testing/advance_test`:
1. broken build, QA FAIL, hand-over of the exact error, fix, QA PASS, honest report ("the first build was broken").
2. the fix never works: QA FAILs again; after the second failed fix the lead changes the approach or says it FAILED; reply must not say done.
3. nothing was built (a greeting, a question): QA is NOT started; and a "please test it" that is named (`--user-asked`) does start it.
4. branches of 1: "bug remains, the lead detects it" and "bug fixed, quick video" (the old 6a / 6b intent).
Open: the lead's hand-over quality is judged on the call list; the honest ending on `reply_forbid` words (T-01 says those lists are untuned).

---

## 3. B. T-14, the Solarin web crash: kept as THE negative case

T-14 stays open and is NOT obsolete (the dependent TODO lines T-15 to T-21 are, see section 5). It is a real bug in a real recorded app; the question for the harness is: **does QA or the lead catch it, and does the team repair it?**

Facts (TODO T-14 / T-19, `demos/solarin.ts`, `docs/QA_ISSUES.md`):
- on web the page crashes: `Cannot access 'abandonBoundaryMeasurement' before initialization`, a circular import in `react-native-screen-transitions@3.13.0` (`coordinator.js:167`); it works on native. The screenshot shows Expo's red overlay.
- `^3.8.0` resolves to 3.13.0; pinning 3.8.0 has no `createNativeStackNavigator` (TS2614) and Metro then cannot resolve `@react-navigation/core` (an undeclared dependency).
- the fixture already ships 3 real fix patches: `0001` types, `0002` declares `@react-navigation/*` (this may already remove the Metro error), `0003` `@/` imports. "The web crash stays." There is no fourth patch.
- the web stub `infra/qa/web_only.mjs` exists for the happy examples (like `@expo/ui`). **It must NOT be applied to this case**: it would hide the bug from QA.
- `infra/qa/web_dev_qa.ts` (dev server in a 2 GB / 1 CPU container) is built and never run on Solarin: its speed and memory are unknown.

Cases (chain after `eg_solarin_03_08b0cce`; ids start with `eg_` so the route prefix still holds):
| id | what happens | passes when |
|---|---|---|
| `eg_solarin_neg_01_qa_catches_web_crash` | the person asks "does my-app run on web?"; builder is mocked, the qa-reviewer is REAL and opens the web dev server | QA answers FAIL and names the package, the version and the error text, with `NEEDS_CHANGES`; the lead reports it honestly (`reply_forbid`: works, done) |
| `eg_solarin_neg_02_fix_and_recheck` (branch of 01) | the lead hands the finding to a builder (fixture serving the 4th patch), asks QA again | QA passes (or PARTIAL with evidence); the lead says the first run was broken and what fixed it |
| `eg_solarin_neg_03_wrong_fix_stops` (branch of 01) | the builder's "fix" changes nothing, twice | the lead changes the approach or says it FAILED; never "done" |

The repair (the missing 4th patch), in this order, to be proven in the dev server before the case can pass:
1. a published version of the package that has the API and no cycle (look at the registry, pin through `overrides`, plus patch `0002`);
2. else a pnpm `patchedDependencies` patch that breaks the cycle at `coordinator.js:167`;
3. made as a real `git diff` in `agent_fixture/store/expo_go/fixes/solarin-my-app/` (same way as the first three; `store/expo_go/make_patches.py` is the route for real patches).
Wiring in `solarin.ts`: switch `qa` on (`{ enabled: true, kind: "expo-web", app: "my-app", route: "/", viewport: "390x844" }`, the recipe is already in the comment), keep the builder mocked and the qa-reviewer real. **Unproven:** that one case can mock one role and run another for real (`fixture.mock` per case names the mocked roles; check at build time).
Also fix `NOTES.md` that `before_node_run` writes: it tells agents to run `tools.ts qa_check`, which does not exist any more; it must say "ask the qa-reviewer".
Status: PLAN. Code later, marked `// NOT_TESTED:`. No run now (cost and time are unmeasured).

---

## 4. Refactors found while looking (do them while the files are copied into f3)

| # | What | Where | Why / risk |
|---|---|---|---|
| R1 | the config key `qa_check` means "video off" and shares its name with the removed command; `qa_video` already exists | `harness/core/loops_ai.ts` (`LoopsConfig`, `readConfig`), `chapters/qa.md:25`, `agents/qa-reviewer/.claude/CLAUDE.md:21`, `harness/tools.ts:80`, tests CX32 and CX35 in `multi.ts` | confusing; a clean read needs `qa_video` only, with the old key read for a while and warned about. Touches 2 prompts + 2 tests |
| R2 | two suite loaders with their own `RawCase` types | `f1.../testrun/cases.ts` (`loadSuites`, `SuiteCase`) and `TestCases/ui/test_structure/server/data.ts` (`loadSuites`, `RawCase`) | one loader in core, both import it (this matches `docs/03` where `testrun/cases.ts` is a mixed file). Also unused imports left in `cases.ts` |
| R3 | the UI never type-checks: `vue-tsc` reports 20 errors. (a) DEAD, no importer anywhere: `src/components/flow/ChainCard.vue` (imports `isOpen`, `toggleCard` that `src/store/dashboard.ts` no longer exports, removed in 13bf272), `src/components/flow/SuiteCard.vue`, `src/store/fixtures.ts`. (b) IN USE but with broken types: `src/store/mockRuntime.ts` (7 errors; imported by `components/panels/TryCall.vue`), `TryCall.vue` (2), `BeforeRunRules.vue` (1): they import types (`TestSession`, `BeforeRunRule`, `SubAgentMock`, ...) that `shared/types.ts` no longer has. (c) `AgentConversationPageDeprecated.vue` is still ROUTED (`/experiment/agent-old`): not dead | (a) no behaviour change; archive, do not silently delete (the "never delete" rule is about test cases; UI code is decided in D6). (b) needs the types restored or the panels fixed: a real, small fix. Also `harness/core/browse.ts:165` has a `this` type error. Until both are done `pnpm run typecheck` cannot be green |
| R4 | stale words for the removed QA mechanics | `Cases/real_usecases/test_expo_go/demos/solarin.ts` (NOTES.md text, comments `no_qa_check`), `agent_fixture/store/advance/stages.ts:80` (comment for the broken-app stage), `testrun/chat.ts:43`, `testrun/run.ts:3`, `f1.../PROGRESS.md`, `infra/qa/dev_qa.sh` (`QA_MODE=check`) | `multi.ts` CX35 already guards prompts and tool docs; extend its file list to the case folders |
| R5 | a custom agent's prompt lives in the OS temp folder | `harness/core/custom.ts` (`lf-custom`) | TODO T-27: move into `store/agents/<agent_id>/` |
| R6 | `TODO.md` mixes open work, history and obsolete items | `TestCases/test_folders/TODO.md` | after section 5, split "open", "obsolete by design", "done" into three blocks; never delete a line |

My own earlier slip, to correct in the same pass: I said the Flow cards show the group of a suite. They do not: I put the chip into `ChainCard.vue`, which is dead (R3). The group is only visible in the case picker of the Experiment page (`ChatPanel.vue`, `group > suite`). If the Flow page should show it, the place is `FlowCanvas.vue` / the card it renders.

---

## 5. Marked for later, and the TODO.md lines to change when building

LATER, as asked: the demo checks (folio, linear-tab-bar, enzo clerk toast, tailwind / storybook examples; each type check in the container is 1 to 2 minutes), the live run of the 15 sub-agent cases (T-23), video start / state / stop (T-25), the custom sub-agent helper with QA only (T-26), the agent session folder (T-27).

TODO.md edits (at build time, one pass):
- T-14: keep, add "negative case, section 3 of `f3_multiagent/changes.md`".
- T-18 (Solarin with the loop) becomes cases `eg_solarin_neg_01..03`; T-19 options (b) and (c) refer to the removed `qa_check` / `expect_qa`: keep option (a), a real fix fixture, as the 4th patch.
- T-15, T-16, T-17, T-20, T-21 stay marked obsolete by design; their intent moves to A3 (T-24 says the same).
- T-24: link to A3.
- new lines: A1 (tool tests, `NOT_TESTED`), A2 (qa_reviewer cases), R1 to R6, "demos: check later".

---

## 6. Decisions needed (answer once, then the build can start)

| # | Question | My lean |
|---|---|---|
| D1 | ids of the new loop cases: reuse `adv_5`, `adv_6` (their docs and TODO lines stay valid) or new ids `adv_7`+ (no confusion with the removed ones) | new ids; the old ones are history (H20) |
| D2 | a cheap deterministic pre-check (type check + dev server + page errors in one command) again, or only the QA agent? H20 removed it because the tools "encoded policy" | no tool; put the recipe into the project memory `.loopsAI/README.md` that QA already reads |
| D3 | checkpoint commits per attempt (old `qa_check` did this) | drop: QA works in a copy, builders hand back patches |
| D4 | who judges the real QA answers: a person, or a haiku judge against `must` (T-01) | person first, judge later |
| D5 | Solarin repair route: 1 (other version) or 2 (pnpm patch) | try 1, fall back to 2; never the web stub |
| D6 | what happens to dead UI code (R3): archive folder, or keep and fix | archive |
| D7 | f1 or f3: do A1, R1, R2 first in f1 (small, now) or only in f3 (`docs/10` decision 2) | only in f3, so f1 stays the reference |

---

## 7. Sources checked

git: `git log -S"adv_5_broken_app_qa_check"` (added 59bc40d, removed f551fce), `git show f551fce`; docs: `docs/RUN_FINDINGS.md` H20, `docs/QA_ISSUES.md`, `docs/PROJECT_MEMORY.md`; code: `agents/lead/chapters/qa.md`, `agents/qa-reviewer/.claude/CLAUDE.md`, `harness/core/loops_ai.ts`, `core/tab.ts`, `core/browse.ts`, `core/custom.ts`, `core/agent_call.ts`; tests: `self_test/multi.ts` (CX22 to CX36, PK11 to PK29), `Cases/core_testing/advance_test/verify.ts`, `infra/qa/`; cases: `demos/solarin.ts`, `Cases/subagents/qa_reviewer`; UI: `src/store/dashboard.ts`, `src/components/flow/ChainCard.vue`, `vue-tsc` output.
