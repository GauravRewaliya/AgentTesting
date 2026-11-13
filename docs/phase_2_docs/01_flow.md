# 01 Flow (dynamic)

1. **Master decides.** A small, clear job goes straight to the builders (no planner, no extra cost). A big, vague or multi-part product (several screens, data model, FE and BE) goes to the planner first.
2. **Planner plans with the user.** It asks only the questions that change the plan, with a default for the rest. It writes only the files the task needs into `docs/planning/<project>/`: `00_brief.md` (goal, scope, requirements R1.., open questions), `02_ux_flow.md`, `03_data_model.md` (API contract, types), `05_work_split.md` (files per package, never shared), `PHASES.md`, `decisions.md`.
3. **Prototype on the fly.** The planner asks the FE team (`ux-designer`, `builder`) to split the screens into components and make a quick prototype. It is shown to the user (Artifact page or path). User feedback goes back to the SAME planner session, the plan and prototype are updated. Repeat until the user is happy. No fixed number of rounds.
4. **Build.** After the user is happy the planner records the data model, API contract, types and the work split. The master spawns FE and BE builders: FE builds components against the prototype and updates API docs if needed; BE builds DB/API on the planned stack.
5. **Problems during build.** A team raises it to the master; the master asks the planner (not another builder). The planner decides if it is a plan defect: if not, it answers from the plan; if yes, it updates the plan, names the affected teams, writes a one-line decision, and says when the USER must decide (scope, UX or cost change).
6. **Phases** (`../PHASES.md`) are a guide: phase 1 catalog and UI/UX flow, phase 2 data and API, and so on. Each phase is stored with its task catalog and expected result.

Structure: the plan folder splits itself when a file grows (e.g. `02_ux/` with an index and parts), files move with their links fixed; rules in [planning/README.md](../planning/README.md).
