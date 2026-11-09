# Test_agent_3 dashboard: plan (phase 1 = components on fixtures)

Goal: see every test case on one vue-flow canvas, open one test session on its own page (stack + logs),
and poke a sub-agent mock from a right-hand panel. Nothing is cleared: a test session id is kept.

## Data truth today (no database behind Test_agent_3)
`.state/last/<case>.json` (result), `.state/<case>/ckpt.json` (lead session id + sub-agent ids),
`.state/harness.jsonl` / `trace.jsonl` / `mod_events.jsonl` (events). `src/types` maps these 1:1.
A `DataSource` (store/dashboard.ts) is the only thing that knows where data comes from:
fixtures now -> `Bun.serve` reading `.state/` (phase 2) -> Postgres via `Bun.SQL` if you want it (phase 3).

## Screens
1. Flow (`/`): suite cards on a vue-flow canvas, filter bar, right collapsible SubAgentPanel.
2. Test (`/test/:sessionId`): SessionHeader, SessionStack (test_session_id-workspace_id > lead > sub-agents, nested indented), EventLog filtered by the selected session.

## Components (src/components)
common: DebugFrame, StatusBadge, SessionId | flow: FlowCanvas, SuiteCard (node), CaseRow, SubTestRow
panels: SubAgentPanel, BeforeRunRules, TryCall | detail: SessionHeader, SessionStack, EventLog

## Store (src/store)
dashboard.ts (state, filters, selection, panel, DataSource) · mockRuntime.ts (checkBeforeRun / run / tryCall, pure) ·
debug.ts (flag) · fixtures.ts (sample data)

## Debug flag
`?debug=1`, header checkbox, or key D. On = dashed frame + component name on every component; off = plain page.

## Open questions for the wireframe review
- Chains (`after`): indent + "after x" text now; draw row-to-row edges instead?
- Mock edits (rules) live in memory; should they save back to `helper/agents/*.ts`?
- One card per suite, or per chain?
