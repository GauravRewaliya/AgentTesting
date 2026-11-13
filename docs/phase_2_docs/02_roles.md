# 02 Roles

| role | does | does not |
|---|---|---|
| **Master / lead** | decides if planning is needed, calls the planner, shows the prototype to the user, relays feedback, splits work from the planner's split, spawns FE/BE, forwards problems to the planner | edit files, edit the plan, decide plan changes itself |
| **Planner** | holds all context, owns `docs/planning/<project>/`, plans with the user, orders the prototype, answers escalations, keeps the decision log | edit files itself (read-only; its sub-agents write) |
| **PM** | the user's contact while the team works (status, requirement changes, replan) | read or edit project files |
| **FE team** (`ux-designer`, `builder`) | split components, make the layout and the exact UX/UI, use the store and proper types, update API docs when needed | invent backend or data sources |
| **BE team** (`builder`) | DB, API and linking on the planned stack; asks the master when something conflicts with the plan | change the stack on its own |
| **QA** (`qa-reviewer`, `qa_check`) | checks the build against the plan and finds broken cases | |

Teams never talk to each other directly, only through the plan (via the master and planner).

Code: `test_harness/core/orchistraitor/f1_multiagent/harness/agents/{lead,planner,pm,ux-designer,builder}/`. The planner can call `ux-designer` and `builder` (max 2 children); it stays `writes: false` so the existing planner cases keep working.
