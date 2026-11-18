# docs/planning: what the planner writes, and the notes behind it

## The format in use
The `planner` agent researches, then writes `run_test/plan/` in the format real builds proved, and runs the free `team plan_lint` before it reports:

| file | for | holds |
|---|---|---|
| `README.md` | the person and the developer | frontmatter `audience`; Build recipe; What is it; What you get (feature catalog); Look and feel; Quality bar; Research (sources and what each changed) |
| `PHASES.md` | both | phases, task table (one owner per file), **Done when** checks a browser or command can run, Not in this build |
| contract / `build_inputs/` | developers | routes, data shapes, design system, per-builder briefs |
| `CONTEXT.txt` | the harness | the files every builder gets in front of its first prompt |
| `pending.md` | the person | questions only they can answer, with the planner's default |

Spec for the planner: `test_harness/core/orchistraitor/f1_multiagent/harness/agents/planner/.claude/plan_format.md`. Real results, loopholes and decisions: `docs/RUN_FINDINGS.md` section 2d.

## Notes in this folder
| file | what |
|---|---|
| `RESEARCH.md` | how others guide long AI coding tasks (Anthropic harness, Ralph loop, spec-driven tools), how teams hand work over, and what our own runs showed |
| `ROADMAP.md` | what is NOT built yet: `tasks.json` + resume routine, master loop with an evaluator, the user/dev docs viewer, negative score, behaviour cases |
| `vue_web_targets.md` | decision and per-example table: prototype as Vue web, tag `native-only` |

## Rules kept from the older, bigger file set (for multi-team products)
For a big product with several teams the plan can grow a folder of depth files (`00_brief.md`, `01_architecture.md`, `02_ux_flow.md`, `03_data_model.md`, `04_code_flow.md`, `05_work_split.md`, `06_test_plan.md`). They grow on demand, never all at once, and follow the same rules:
- **Status header** on every plan file: `> Status: draft | agreed | building | done  ·  Updated: YYYY-MM-DD`.
- **`decisions.md`** as mini-ADRs: `D-NN title | Status | Context (1 line) | Decision | Consequences`; a decision that outlives the task is never edited, only superseded.
- **`AGENTS.md`** per package: stack, rules, how to check (a builder reads the guide of the folder it changes). **`learnings.md`**: one line for a gotcha an agent had to work out.
- **Split a file into a folder** when it passes about 150 lines or two teams need different parts (`02_ux/` with a `README.md` index plus one file per part); merge back when a part stays tiny. One owner per file, one topic per file.
- **Links** are relative md links; moving or renaming a file fixes every link to it in the same step. Free check: `bun test_harness/scripts/check_plan_links.ts <plan folder>`.
- Types and interfaces first (data model and API contract), so builders in parallel never disagree; every work package lists the files it owns, and two packages never own the same file.
- The plan lives in files, not in chat: a new agent gets only the path.
