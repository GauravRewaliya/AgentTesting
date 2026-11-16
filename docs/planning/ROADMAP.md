# Roadmap: planning huge projects so agents run for hours without a human (what is still NOT built)

Replaces `architecture_plan.md` (its history and the parts we built differently are gone; the full original is in `old_data_bkp/docs_cleanup/`). Research behind it: `RESEARCH.md`.

## Already built (do not rebuild)
| idea from the old plan | what exists |
|---|---|
| a planner that interviews, researches and writes the plan | `planner` agent: R&D first (WebFetch, researcher, `ref_capture`), writes `run_test/plan/` in the proven format, free `team plan_lint`; spec in `harness/agents/planner/.claude/plan_format.md`, results in `docs/RUN_FINDINGS.md` section 2d |
| done-conditions written before the run | **Done when** list in `PHASES.md` (numbers, routes, quoted text), required by the lint |
| tiny hand-over, shared context | `run_test/plan/CONTEXT.txt` in front of each builder's first prompt; per-builder brief named in the objective |
| ordering check | `check_phases.ts` (older dialect), phase gates in code (`phase_pass`), `plan_lint` for the new format |
| one owner per file | the lint (files and folders) |
| a lead that does not stall | queue visibility, true cost, `wait` activity info, free status answer |

## Not built yet (in order of value)
1. **`tasks.json` + `progress.md` + a resume routine.** Machine-readable task state (id, phase, owner, files, `needs`, `reads`, `steps`, `status`, `passes`; agents may flip only `status` / `passes`), an append-only `progress.md`, and one start routine for any agent: `pwd`, tail progress, git log, the top of `PHASES.md`, a smoke check (`init.sh`), do ONE task, check, commit, append. Needed for runs that outlive one session; the one-shot plans in use today do not need it.
2. **Master loop with an evaluator.** Pick the next task whose `needs` are done and whose phase is building; delegate "task id + path"; an evaluator (not the builder) runs the `steps` in a browser and sets `passes`; retry at most twice with the failure text, then mark `blocked` and write `pending.md`; when a phase passes, run its exit check and `phase_pass`; when only blocked tasks remain, stop and ask the person once.
3. **Docs for the person and the team from one source.** Page front-matter (`audience: user | dev | both`, `title`, `summary`, `status`) already exists in the plan format; missing is the viewer: a small separate server (not part of the test UI hub) that renders `docs/` and plans, builds a catalog and sidebar from front-matter, and has a top toggle User / Dev that hides the dev blocks. Goal: stakeholders see what is planned, what is being built and what to expect (layout, features) without reading code, and each reader fetches only the depth they need. A prototype exists in `docs/dev_exp/plan_viewer/` (untested).
4. **Negative score (separate from pass/fail).** A free detector over the session logs, no model call: apologies ("sorry", "I misunderstood") -1, rework -2, user correction -3, early "done" -3, acting against `decisions.md` -3, hand-over too long -1. Stored per agent and per prompt version so a prompt change shows as a score delta; read through the hub topic, never polled.
5. **Behaviour cases for the planner and lead** (cheap, sub-agents mocked): `plan_first` (a big vague request goes to the planner, no builder before plan files exist), `handover_is_pointer` (task id + path, not the whole request pasted), `resume` (continue the right next task from a half-done `progress.md`), `no_early_done` (tasks left, no "finished"), `ask_user_right` (missing info goes to `pending.md` plus one question), `defect_to_planner` (a plan defect goes to the planner, the lead does not patch the plan).

## Open questions (default in brackets)
- Wiki viewer: a small bun server with a Vue page [yes] or a static generator?
- `tasks.json` as the only status truth with the TODO block of `PHASES.md` generated from it [yes]?
- `progress.md` also feeds the score detector [yes]?
- Not yet exercised with a real run: a multi-phase product, a clone with a captured reference, the feedback loop with the person (the same planner session).
