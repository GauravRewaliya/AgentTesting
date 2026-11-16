# prompt_fixtures: frozen PLANS used by test_prompt_planning (index, and expected quality vs got)

A fixture is a **snapshot** of a plan from `docs/vibe_planning_examples/<plan>/` (the living source of truth). A case copies it into the workspace as `run_test/plan` in `before_node_run` (`seedPromptFixture(ctx, plan, shape)`, `test_prompt_planning/lib/seed_prompt.ts`), BEFORE turn 1; the single turn is "Can you build the plan that is in run_test/plan?" (the old "hi" turn was dropped 2026-11-16). Editing a plan in docs does not change an old test.

| plan | shape | build target | case | status |
|---|---|---|---|---|
| `site_clone_pingharbor` | `one_phase_complete` | `run_test/pingharbor` | `pp_site` | in use |
| `composio_admin_dashboard` | `one_phase_complete` (phase 1 only, fake data) | `run_test/agentdeck` | `pp_composio` | in use |
| `aistudio_eiffel_tower_3d` | none: one flat plan folder (+ `build_inputs/`: 12 stops EN/FR, 11 photos from the reference zip; no source code) | `run_test/eiffel` | `pp_eiffel` | in use, not run yet |
| `wavelet_spotify_clone` | none: flat folder (+ `build_inputs/01_content.md`: 8 playlists, 40 tracks from the reference zip) | `run_test/wavelet` | `pp_wavelet` | in use, not run yet |
| `enzo_clerk_toast` | none: flat folder (4 phases) | `run_test/clerk_toast` | `pp_clerk_toast` | in use, not run yet |
| `linear_tab_bar` | none: flat folder (6 phases; open questions answered with defaults) | `run_test/tabbar` | `pp_tabbar` | in use, not run yet |
| `creative_browser_templates` | none: flat folder (2 phases) + `build_inputs/01_facts.md` (room map, slider numbers, palettes, three.js vendoring) | `run_test/creative` | `pp_creative` | in use, not run yet |
| both plans | `multi_phase` (the plan as in docs, several phases) | same | none yet | fixture exists, add a case later |

`one_phase_complete` = same plan, only `PHASES.md` and the phase lines of `README.md` folded into ONE complete phase. Refresh a snapshot: copy `docs/vibe_planning_examples/<plan>` over `<plan>/multi_phase`, then rebuild `one_phase_complete` (copy, fold `PHASES.md`). Nothing here is a recorded sub-agent result (those live in `results/`).

**Run (plan IS the planning, so no planner):** `HARNESS_SANDBOX=docker bun testrun/run.ts test_prompt_planning pp_site --real --no-planning` from `test_harness/core/orchistraitor/f1_multiagent`. Do NOT use `--stop-pause` for judging: it forces plan > wireframe > UI and fights a finished plan.

## Expected quality (what a good run looks like)
1. **Turn 1 'hi':** short greeting, NO sub-agent, NO file. 
2. **Turn 2:** the lead reads the plan in the order its *Build recipe* gives, starts from the kit (`proto_init`), builds the target folder with SEVERAL builders in parallel (one per screens file, only its own files), delivers FINISHED pages (original copy + styling, light and dark), no wireframe/placeholder step, no reference capture, nothing the plan does not name.
3. **Claims:** it runs the checks (`site_audit` / `proto_check` + preview), reads EVERY builder report, claims only what those show, lists deviations, says what it could not check.
4. **Result (site):** 5 linked pages, six blog slugs only, theme toggle, scroll reveal, PingHarbor brand, contrast >= 4.5:1 (small accent text on light `#047857`), `site_audit` >= 80 with 0 high. **Result (composio):** 10 screens on fake data, light + dark kept after reload, Playground Run adds a Logs row, no later-phase work.
5. **Cost:** site <= $2 (earlier full run with capture and briefs: $1.39), composio <= $2.5.

## Got (real runs, newest last)
### Run 1 (step mode `--stop-pause`, plan as first written)
| case | what happened | cost | verdict |
|---|---|---|---|
| `pp_site` turn 1 | greeted, no agent, no file | $0.08 | PASS |
| `pp_site` turn 2 | read the plan, ran the kit, 3 parallel builders wrote `part-1..3.js` (34 KB), no TODO, no 'upwatchr'; stopped after a WIREFRAME step (my flag) | $0.74 | built, **3 defects below** |
| `pp_composio` turn 1 | greeted, no agent | $0.08 | PASS |
| `pp_composio` turn 2 | read the plan, kit, 3 builders: 10 routes in 3 files, no TODO, preview up (HTTP 200); wireframe step only; Run = toast, no Logs row, no count-up | $0.31 | built, **2 defects below** |

**Defects found, cause, fix**
| # | defect | cause | fix (done) |
|---|---|---|---|
| 1 | part-2 linked 3 blog slugs part-1 never defined (`header-audit-2026`, `windows-uptime-numbers`, `status-pages-review-2026`) | PLAN: brief 03 (copied from the first run) had a different slug table than brief 02 and the README | brief 03 table and links rewritten to the six slugs; contract got a 'Blog slugs (the ONLY six)' section |
| 2 | lead said 'every link goes to a real route' (false) and 'I haven't opened the pages / run preview' | lead claimed without checking; the plan did not require verification before claims | recipe item 10 + case expectation: run the audit, read every builder report, claim only what they show |
| 3 | lead did not read builder 3's report ('differs from the brief in a few places') | same | same (item 10) |
| 4 | builders only ran `node --check` | plan did not say what builders must self-check | recipe item 9: `node --check`, `proto_check`, every link target exists |
| 5 | lead 'did step 2, the wireframe' and ended with 'Say next' | MY TEST: `--stop-pause` forces plan > wireframe > UI | run with `--no-planning`; recipe item 8: this plan IS the planning, finished pages in one pass |
| 6 | composio plan names `main.js` / `build.js` and `pages-main.css`; the kit makes `part-1..3.js` / `pages-part-N.css` (lead reported the mismatch honestly) | PLAN named files the kit does not create | all file names now `part-N` with a File-names note; Playground + Logs stay in the SAME file |
| 7 | composio: Run only shows a toast; Home count-up missing | wireframe step only (flag), not a plan gap | expected to be built in the full run |

### Run 2 (full run, `--no-planning`, after the harness, plan and prompt fixes; `pp_site` alone)
| what | before (run in parallel with composio) | now |
|---|---|---|
| wall time | 11.3 min (6.5 min of it queued behind another lead) | **4.2 min** |
| cost (from `agent.done` events) | $1.97 | **$1.23** |
| first-pass `site_audit` | 77, then a fix round (3 builders resumed) | **98, 0 high / 0 medium, no fix round** |
| builder calls | 3 new + 3 resumes | 3 new |
| lead | 16 turns | 13 turns (it read the chapters `clone` and `parallel`, which a plan build does not need: the core now says so) |
| builders' first calls | `cat` of contract, design system, PROTO.md, then kit greps | contract, design system and PROTO.md arrive as SHARED CONTEXT; they read only their own brief and layouts |
| judge | FAIL (brittle `expected_roles`) | PASS |
Open item left from this run: builder 1 spent about a minute looking at its own result with `browse` and screenshots (the "look at your own result" rule); it is the critical path (3.1 min against 0.7 and 1.4), and it is what made the first pass score 98, so it stays.


## Shared builder context
`<plan>/<shape>/CONTEXT.txt` lists the files (relative to `run_test/`) the harness puts in front of EVERY builder's first prompt (`callee.ts sharedContext`), so builders do not re-read them and share one cached prefix. Site plan: `pingharbor/PROTO.md`, contract, design system. A builder's own brief and layouts stay in its objective.
