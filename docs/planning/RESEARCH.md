# Research behind the planner: how others guide long AI coding tasks, how teams hand work over, what our own runs showed

One page instead of nine. Only what a source says is written here; `(summary)` = seen in a search summary, original not opened. Limit: no source gave measured "ran N hours unattended" data; multi-hour runs are anecdotes. The common cause given for success is the same everywhere: **state in files, small tasks, done-conditions written before the run, verification by someone other than the builder.**

## 1. Patterns from others
| need | Anthropic harness | Ralph loop | Spec Kit / Kiro | what we do |
|---|---|---|---|---|
| plan state | `feature_list.json` | `prd.json` | `tasks.md` | plan folder `run_test/plan/` (`PHASES.md` task table, `CONTEXT.txt`); `tasks.json` is on the roadmap |
| resume | progress file + git + `init.sh` | `progress.txt` | re-read specs | the plan IS the resume point; a status line per file |
| done = | `passes` after a real test | checks pass | acceptance in the spec | **Done when** list a browser or command can run |
| stop a runaway | one feature per session | status failed / blocked | n/a | case cost caps, `max_agent_calls`, a stop rule on tool silence |
| rules | prompt | `AGENTS.md` | constitution | short per-agent `CLAUDE.md`, one line per real failure |
| human docs | none | none | md in repo | `README.md` (user view) + dev sections in one plan |

### Anthropic, "effective harnesses for long-running agents" (read in full) — https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents
Two prompts, one harness: an initializer session writes `feature_list.json` (end-to-end features, each with `steps[]` and `passes`, only `passes` may be edited), `init.sh`, a progress file and a first commit; later sessions do ONE feature, leave the code mergeable, commit, update progress. Session start: `pwd`, git log + progress, pick the top unfinished feature, run `init.sh` plus a basic end-to-end check. Tests: unit tests and `curl` missed broken end-to-end features; browser automation acting like a user worked far better (native alert dialogs are invisible to it). Open question they list: would separate test / QA / cleanup agents beat one generalist?

### Ralph loop (Addy Osmani, read in full) — https://addyosmani.com/blog/long-running-agents/
Pick the next unfinished task, build the prompt, run the agent, run the checks, append to `progress.txt`, set done / failed / blocked, repeat: "the agent is amnesiac, the filesystem isn't". Write the done-condition BEFORE the run, in an external file. `AGENTS.md` is a rolling rulebook where every line was earned by a real failure. Generator is not the evaluator (models grade themselves too kindly). Failure modes: "done" at about 30%, re-introducing fixed bugs, deleting failing tests, stopping early, context rot, cost runaway (needs budgets), secrets in the sandbox. "Writing specs an autonomous executor can follow is harder than doing the work yourself."

### Spec-driven tools (summaries)
GitHub Spec Kit (constitution, specify, plan, tasks, implement; dependency-ordered `tasks.md`), Kiro (`requirements.md` in EARS notation, `design.md`, `tasks.md`), BMAD-METHOD (role-play team, overkill for small jobs), Task Master (PRD to `tasks.json`). Claim worth testing: agents follow order and cannot reorder dependencies, so size phases at about 15 to 30 minutes of agent time. Sources: javacodegeeks.com (spec-driven development with AI coding agents), safeguard.sh, ideaplan.io (how to write specs for AI coding agents), glukhov.org (spec-kit vs kiro vs claude-code), github.com/zhu1090093659/spec_driven_develop.
We take: phase grouping, EARS-style testable requirements, a `reads` list per task, done-conditions, evaluator separate from builder. We skip: BMAD role-play (we have real roles), static specs.

## 2. How real teams hand work over (summaries)
| step | owner | artifact | who agrees |
|---|---|---|---|
| 1 | PM | PRD: goal, users, scope, edge cases | functional + tech lead |
| 2 | UX + PM + lead dev together | wireframes and flows (shared understanding, not the deliverable) | all three |
| 3 | FE + BE together | API contract incl. empty states and errors, with examples | FE lead + BE lead |
| 4 | tech lead | design / RFC from the PRD | tech lead + PM |
| 5 | everyone | docs as code: markdown in git, reviewed in a PR, diagrams as text (Mermaid) | reviewers |
Known weak point: non-engineers avoid git and markdown. Our answer: the person reads the plan's README (what you get, look and feel, Done when) and answers `pending.md`; agents do the git. Mapping: the person is the stakeholder, `planner` the tech lead, `ux-designer` UX, builders FE/BE, the lead runs the free checks.
Source-of-truth rules we keep: behaviour tables are the requirements AND the tests; one owner per file; every plan page opens with a status line; native-only items are written down and marked, never silently dropped.

## 3. What our own runs showed (these shaped the planner)
- Rework in real projects is mostly **interaction rules found by using it** (a gesture must not route until release), **structure** (duplicate files, a 2431-line "simplified file structure" commit) and **maintenance** after library changes. So the plan needs an interaction table before the gesture phase, the file tree decided in phase 1, pinned versions, and a separate migration phase.
- The cleanest project wrote analysis versus own design as a table and put numbers in the README. So: "done" as numbers or browser steps (4.7:1 contrast, a 480 ms fade).
- Group phases by dependency, not by date; one owner per file; tasks of 15 to 30 minutes; each task lists only what it reads.
- A clone built from a login-wall capture was invented from general knowledge: no motion captured, dark and mobile guessed, no done-conditions, and the plan lived in a throwaway folder. So the plan states **captured / user-given / invented** per screen, has a motion table, "Done when" steps a browser can run, a tiny hand-over, and is written to a file.
- The builder's whole context was one brief plus a design system plus the layouts it named, with no chat history: small and good. That is why the plan format keeps per-builder briefs short and puts shared files in `CONTEXT.txt`.
- Built from this: the `planner` agent, `plan_lint`, the shared builder context, the generated kit reference. Measured results: `docs/RUN_FINDINGS.md`.

## 4. Decision on targets
Prototype everything we can as a **Vue 3 web page** (the no-build `proto_init` kit). Something Android or iOS only is not built: it is written in the plan, reviewed on paper and tagged `native-only` (it keeps a row in the plan so the person sees it was considered, with no task and no test). Rule of thumb: if a browser can show the behaviour (pointer drag, CSS animation, canvas, Web Audio, `backdrop-filter`), prototype it; if it needs a device API (haptics, native blur, a native GPU device), tag it. Per example: see `vue_web_targets.md`.
