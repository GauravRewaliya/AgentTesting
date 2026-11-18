# PHASES: waterfall delivery plan

The planning agent (see `planning/README.md`) fills this per project. Phases are a guide the planner and lead follow sensibly (not a hard lock): normally a phase starts when the previous one passed its checks.

Template (one block per phase):

## Phase N: <name>
- **Status:** planned | building | passed  (the planner changes it; a phase may be building only when all earlier phases passed)
- **Goal:** what the user can do after this phase.
- **Depends on:** phase numbers.
- **Task catalog** (task id | what | owner agent | files | expected result | check):
  | id | task | agent | files | expected | check |
  |---|---|---|---|---|---|
- **Public API added:** files/types/endpoints later phases may rely on.
- **Exit check:** commands that must pass (`tsc --noEmit`, `qa_check`, tests), what QA must see.
- **Deploy / hand-over:** what is released or shown to the user.

## Default order for an IT product
1. Phase 1 Foundation: repo, config, types, DB schema + seed.
2. Phase 2 Core flow: main screens + API wired to the data model.
3. Phase 3 Secondary features.
4. Phase 4 QA hardening: broken-case checks, accessibility, performance.
5. Phase 5 Release: build, deploy, docs.

In code (not only a guide): give every plan task `phase: N` in `plan_submit`; the scheduler then starts phase N+1 only after `phase_pass --phase N --evidence "..."` (see `POINTS.md`, `harness/core/phases.ts`).

Free check: `bun test_harness/scripts/check_phases.ts docs/planning/<project>/PHASES.md` (n+1 waits for n, one phase building at a time).
