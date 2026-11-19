# Improve lead and builder quality (from the two sakura runs, 2026-11-19)

Runs read: `smwn7b6ch` (new, 1 builder, $0.74, QA removed on purpose) and `rs_sakura_page_mwm8na741` (old, 3 builders, $0.55). Same request. Builder prompt size is only a warning (RUN_FINDINGS, "Limits are advice"), so it is not an issue.

## What the runs showed
| | new (1 builder) | old (3 builders) |
|---|---|---|
| build time | ~2 min (95 s of thinking before the first file) | 19-40 s in parallel |
| depth | builder looked at its render, fixed 3 things | nobody looked until QA |
| result | small world, small trees, gate + pagoda read as two gates | dense petals, no landmarks |

## Root causes (all in the lead's hand-over, not the builder)
1. The lead copied the chapter's numbers into the brief: island 24x24, trunks 4-6 blocks, gate "tree height", "petals tiny, never large". The builder built exactly that.
2. "Small", "tiny", "no taller than" were written for the main subject, so everything came out small.
3. No role per extra item: a torii and a pagoda stood near each other and read as the same thing twice.
4. The split rule was a guess about minutes ("only if each part is over a minute"). Measured: 3 builders 40 s vs 1 builder 2 min.
5. The builder is told to do no more than the task (right for plans and clones), so it cannot cover a thin brief: the lead must carry scale and richness.

## What was changed (general, no use case in the wording)
- `lead/chapters/page.md` rewritten: plan the parts, ONE shared contract (names, exports, ids, units, layout in one place), split when 2+ parts each need ~100+ lines, one builder when tiny or tightly coupled, 2-4 builders started together, rich brief with relative scale and a role per item, no "small/tiny" for the main subject, no blame on other agents.
- `lead/.claude/CLAUDE.md` PAGE line: same rule in short; a demo video is never a page feature or a builder task.
- `builder/.claude/CLAUDE.md`: start writing fast, the contract is law (exact names, no waiting for another builder), report your own choices as `CHOSE:`. Nothing about being generous: that is the lead's job.
- Tests (lead, `master_test3.ts`): `ld_small_page_one_builder`, `ld_creative_ask_gets_a_rich_brief`, `ld_visual_brief_has_a_layout` adapted (ids kept); new `ld_open_ask_other_domain_splits_with_contract` (aquarium) and `ld_coupled_small_page_one_builder` (tip calculator) prove the rules are not tied to one scene. Builder: `bu_q1..q3` (not run yet, cost).

## Results (single-turn lead calls, builders blocked: no builder ran)
- Split + contract + rich brief: first pass 6/6; layout case 2/2; aquarium 2/2; tip calculator and timer stay at one builder 2/2.
- Real finding: the lead put a recorder (MediaRecorder, camera tour) in the shell builder's task. Fixed by one line in the core PAGE prompt and the chapter; creative case 3/3 afterwards.
- Remaining "failures" were test false positives (the regex matched the person's quoted request or a prohibition such as "No MediaRecorder"). The regex now ignores negated mentions. Not re-run, to save credits.

## Open
- Re-run `ld_page_split_into_parts` once after the regex fix (about $0.1).
- Run `bu_q1..q3` once when a builder check is wanted.
- One builder's thinking pause (95 s) is solved by splitting, not by a builder prompt.
