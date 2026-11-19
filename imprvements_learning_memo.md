# Improvements learning memo (2026-11-19)

Why lead + builder output quality varied (sakura / three.js runs 741 good, 740 bad, tj_1 bad) and what we PROVED. Details: `TestCases/test_folders/TODO.md` T-41, T-42, T-44, T-45.

## 1. Facts found (read from the real sessions, not guessed)
- Wrong Claude account: since 2026-11-18 20:00 the UI/shell ran `claude` WITHOUT `CLAUDE_CONFIG_DIR`, so 49 sessions (741, 740, tj_*) went to `~/.claude` (another account) and only 1 to `~/.claude-personal`. The "weekly limit" failure came from there. FIXED: `claudeEnv()` / `claudeProfile()` (f1 + f3 `harness/core/base/runner.ts`) pin `~/.claude-personal` on every `claude` the harness starts; prompt_test.ts, artifact_run.ts, ui `runs.ts`, `settings.ts` use it. Verified with `env -u CLAUDE_CONFIG_DIR` (works, $0.002).
- 740 / 741 ran on an OLD lead prompt (no PAGE recipe, no `page` chapter): that is why the lead cut a small page into 3 to 4 builders.
- Builders are one-shot and blind BY INSTRUCTION: lead `CLAUDE.md` line 17 tells every builder "a quick syntax check only; I test once at the end. Add nothing they did not ask for"; builder `CLAUDE.md` says "no extra features", "ignore the rest", "lightest check", "the check is the last command". Real builders worked 18 to 97 s, 1 to 3 tool calls, never ran the page.
- Fix rounds were not work: ~5 s per round, one python replace script; the builder admitted "hand calculation, did not run camera.project". The lead turned QA words into camera maths it cannot see; each round made a new defect; re-check hand-overs named only the fix items, so QA #4 said PASS on a picture where the torii hid the pagoda.
- Builder reports (NOT VERIFIED, "assumed signatures", "needs light from another file") are truncated to ~600 chars for the lead and never acted on. Parallel builders cannot see each other (dark petals in 741 = petal material of one builder + lighting of another).
- Tools: `team wait` runs `proto_check` (Vue / no-build prototypes) on every writer: false `ok:false` on three.js pages; the lead's batched Bash (heredoc + several delegates) was denied 4 times; QA launch prompt was over the launch limit; QA gets only 2 pictures.
- Size does not explain quality (740 = most code, worst; 741 and tj_1 same size). What correlates: scope vs ability to check, and depth per part.

## 2. Experiment (own `CLAUDE_CONFIG_DIR=~/.claude-personal claude -p`, builder prompt + the real tj_1 hand-over, 3 runs per condition, same render + pixel metrics, pictures read by eye)
| cond | builder can look | layout numbers in brief | result (3 runs) |
|---|---|---|---|
| A | no | no | 3/3 small island, pagoda + torii collide, 1 black screen (shader error) |
| B | yes | no | 0/3 good composition (torii still dominates), 0 broken |
| C | yes | yes | 3/3 good (trees hero, sun + clouds in frame), 0 broken |
| D | no | yes | 3/3 good composition, 1 black screen |
A reproduces the real tj_1 (70 s, 260 lines vs 74 s, 322 lines). Cost: layout runs $0.34 to $0.72 vs $0.15 to $0.24 (they do more work). Conclusion: LAYOUT NUMBERS FIX COMPOSITION, LOOKING FIXES BROKEN RENDERS; BOTH ARE NEEDED. E / F (the real lead's own layout briefs fed to the builder, blind vs look) were started but NOT scored.
- The real lead (sonnet) now writes concrete layout briefs (`ld_visual_brief_has_a_layout` 3/3, ~$0.055 a run), with `layout.js` as the one owner of positions; it also adds unasked features sometimes (a slider, a toggle).
- Pixel metrics (`harness/core/png.ts`, `visual_metrics.ts`, stable run to run): confetti + clutter separate 741 from 740 (clutter 0.037 vs 0.082, confetti ~31 vs ~190); they do NOT see composition (tj_1 final picture would pass). A black frame (dark share 0.67 to 0.86) and console shader errors DO show up: cheap hard fail.

## 3. What to do (in this order, quick wins first)
1. Lead `CLAUDE.md` line 17: drop "quick syntax check only; I test once at the end"; say "check your result the way the brief names (run it / look once), report the evidence". Builder `CLAUDE.md`: drop "ignore the rest" / "lightest check"; one look at the render + one fix round for a visual deliverable (already drafted, uncommitted).
2. Lead brief for any deliverable: ACCEPTANCE LIST (3 to 8 checkable statements) + numbers (sizes, positions, camera, counts). Already in `page.md`; extend the idea to API / CLI / library (routes + status codes; commands + outputs; functions + one test).
3. Lead reads the FULL builder report (not 600 chars) and turns every NOT VERIFIED / "assumed" into a check someone owns before `apply_patches`.
4. Every re-check carries the full list, never only the fix items; the lead gives observations, not camera maths. QA `PASS` without a `QUALITY:` line on a visual deliverable is capped.
5. Tools: `proto_check` only when `proto.json` exists; tell the lead not to batch commands in one Bash; shrink the QA launch prompt.
6. Guards in code: at most 3 builders and 3 fix rounds per page project; hard-fail gate on a black frame / console shader error / confetti / clutter (warn on flat / dark).
7. Consistency suite: same ask 5 times per deliverable type, accept 4 of 5, always on `.claude-personal`.

## 4. How to experiment fast next time
Scratch rig (not in the repo): `render.ts` (serve folder, 2 pictures, metrics), `run1.sh <cond> <n> <prompt> <handover>` (claude -p with the builder prompt), `score.sh`, `montage.py`. 12 runs cost about $4 and 8 minutes in parallel. Always look at the pictures: the metrics alone said nothing about composition.



❯ look builder can look, but if it like => parallel call one is fixing the issue, other to jsut code , and other for feature
  all must to there personal work very well. as if it have look and try so every builder may try to look on there work before stuff which can be mush testing and do ing other works taht its have bug and let me fix and all mess
  hop its clear why was done like that
  but small and poor island and quality is major issue
  -- hop you add this to the readme rerpot
  as improve power of builder is good. but we dont want too much time and did start workign which we not told to
  it can do tell the lead that i did coded or request to look [ then check self ]. or can granted by lead default can check. or builder can report taht i codeed my task .. but found other bugs which was on already so sould i fix
  so lead can check and know if already an git pr or other builder doign work and if it need to do or not or can do lead check the code first is it so or nto
  hop its will be like good team without re-work or the extra stuff right
  efficient and work on team and proepr cordiaiton
  do mention all this in readme for now

## 5. Team design (your words, 2026-11-19) and what is coded
Goal: a good team without re-work and without extra stuff, efficient, with proper coordination.
- Builders MAY look at their own work (a render, a run). Parallel builders can have different jobs (one fixes an issue, one only codes, one adds a feature) and EACH owns its part and checks it before it reports. The cost we want to avoid: a builder that starts work nobody asked for, or testing so much that it builds on bugs and the lead has to fix the mess.
- Where a builder goes beyond its task it asks instead of doing: it reports "I coded my task, but found another bug (`FOUND:`), should I fix it?", or asks the lead to grant a longer check or a look. The lead may also grant a look by default in the hand-over (the acceptance list says how to check).
- The lead decides: before saying fix / leave / hand on, it looks whether another builder or an open git change already covers it (`agents_list`, `git log`, `grep`, the code itself).
- Poor small island = quality is the main issue: fixed by layout numbers + an acceptance list in the brief (section 2), not by free-running builders.

CODED (2026-11-19, prompts only, NOT run): lead `CLAUDE.md` (acceptance list in every hand-over, full builder report read, every NOT VERIFIED / FOUND gets an owner, full-list re-check, one Bash per call, "syntax check only" removed); builder `CLAUDE.md` ("ignore the rest" -> `FOUND:` lines, "lightest check" -> the check that proves it, ask the lead for more instead of expanding, look at the render for visual work). `check_prompts.ts` is clean (lead 7862 chars, builder 7363). Still to do: section 3 items 4 (QA `QUALITY:` cap), 5 (tools), 6 (guards), 7 (consistency suite).

### Code changes 2026-11-19 (f3, free checks only, NOTHING run against a model)
- `harness/core/loops_ai.ts` `leadSummary()` + `callee.ts`: the lead's `summary` of an agent answer was `reply.slice(0, 600)`, which cut the closing `VERIFIED` / `NOT VERIFIED` / `FOUND:` blocks. Now: a short answer whole; a long one = first 600 chars + the closing blocks (about 1700 chars max), and the whole text stays in `ledger_get`. Self-test `LS1` added (`self_test/multi.ts`); the function was also run on sample text.
- `harness/tools.ts`: `proto_check` (per finished writer in `wait --any`, and the all-done sweep) now needs `proto.json`, so a three.js page or a plain wireframe no longer gets a false `ok:false`.
- Builder prompt: after the ONE fix round a `node --check` again, a second look only if the first picture was blank / black / threw an error.
- Prompt cases written, NOT run: `bu_found_other_bug_reports_not_fixes`, `bu_asks_lead_for_more_check` (builder_test.ts, 167 prompt cases well-formed).
- DECIDED NOT TO BUILD (kept stable): a hard code cap of 3 builders / 3 fix rounds. Builders are already capped at 4 per role per task (`maxInstancesPerRole`), the PAGE recipe says 3 and 3 fix rounds, and a hard cap would break PLAN / clone runs that legitimately use more builders and continue them per phase. QA `PASS` with no `QUALITY:` line is left alone on purpose (`capVerdict` already lowers `PASS` + `QUALITY: poor` to PARTIAL): a non-visual check has no quality line.
- STILL OPEN (needs wiring and a live check): the `visual_check` hard fail (`png.ts` / `visual_metrics.ts` exist, thresholds from this memo: black frame dark 0.67 to 0.86, clutter 0.037 vs 0.082, confetti 31 vs 190), console shader errors, the QA launch prompt size, 2 pictures for QA, the consistency suite, f1 copies (f3 is the current engine).

### Claude account: one place (2026-11-19)
`CONFIG.claudeProfile` in `test_harness/core/config.ts` (ONE static string: `"default"` = `~/.claude`, `"personal"` = `~/.claude-personal`, or an absolute folder; its comment lists what else to check when it changes); env `HARNESS_CLAUDE_PROFILE` overrides for one run; Set to `default` now because `~/.claude-personal` hit its 5-hour limit (the 06:49 UTC master_test3 run failed with "You've hit your 5-hour limit", not with a prompt problem). Docker still mounts its own dir (`CLAUDE_PROFILE_DIR`). Done in `claudeProfile()` of f1 + f3 `runner.ts`; self-test line 675 reads `claudeProfile()` now.
