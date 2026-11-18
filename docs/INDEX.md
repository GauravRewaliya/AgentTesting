# docs index (QA, sandbox, and where the rest lives)

| file | what |
|---|---|
| `QA_ISSUES.md` | the QA video work: every issue we hit, why, the fix, status; how loopferry does QA and why it is smooth |
| `SANDBOX.md` | how loopferry isolates its agents (E2B template) and how we do the same locally with Docker and volumes |
| `PROJECT_MEMORY.md` | commands, tools, plugins and layout of the project (read first) |
| `PROTOTYPE_KIT.md` | fast prototype flow: `proto_init` starter kits (app + site), parallel builders, per-route preview check, lookup agent + reference store, connected browser, site audit; past vs now (2026-11-13) |
| `RUN_FINDINGS.md` | catalog of what we pointed out and found in the plan-driven runs: answers to the owner's questions, issue tables (harness, plan, context and tools) with cause, fix and status |
| `POINTS.md` | what the harness must have for IT-style phased delivery: done / open list, compared with Claude Code (slash commands, phase gates, peek, budget) |
| `PHASES.md` | waterfall phase template (task catalog per phase) |
| `planning/README.md` | what the planner writes (the format in use) and the notes behind it |
| `planning/RESEARCH.md` | research: how others guide long AI coding tasks, how teams hand work over, what our own runs showed |
| `planning/ROADMAP.md` | what is NOT built yet: tasks.json + resume, master loop with evaluator, user/dev docs viewer, negative score, behaviour cases |
| `planning/vue_web_targets.md` | decision: prototype as Vue web, tag native-only |
| `../user_read.md` | what loopferry has / we have / is missing, test cases to port, how to run and check |
| `../CLAUDE.md` | project rules (fixtures first, pnpm only) |
| `../TestCases/test_folders/TODO.md` | open work and failed cases |
| `../test_harness/core/orchistraitor/f1_multiagent/PROGRESS.md` | done list, bug catalog and run log of the f1 harness |
| `dev_exp/` | sandbox for prototypes/diagrams; promote to docs when agreed |
| `TestCases/test_folders/agent_fixture/prompt_fixtures/` | the plan catalog and every frozen plan (README, plan_scores, method/); open them in `dev_exp/plan_viewer` |
| `aistudio_examples/` | draft `prompt.md` per AI Studio app (eiffel, terrarium, clockwork, voxel, comics, ...); source info only in its index.md |
| `dev_exp/plan_viewer/` | static viewer for plan folders: md + mermaid + inline html wireframes, User/Dev toggle (prototype, untested) |
| `dev_exp/walkthrough/` | click-through plan player (plan page + separate phases & tasks page; flows, wireframes, expandable refs); each plan declares `walkthrough.json`; spec in `dev_exp/WALKTHROUGH_SPEC.md`; check `bun docs/dev_exp/walkthrough/validate.ts` |
