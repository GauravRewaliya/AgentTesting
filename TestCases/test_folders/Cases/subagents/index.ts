// Route table: SUB-AGENTS = the sub-agent itself is the thing under test. The lead only passes the task through (`lib/make.ts`, `subCase()`).
// Every case runs the REAL sub-agent (credits): by case id on purpose, capped by max_cost_usd. Mounted by ../index.ts.
// Not covered yet: lookup (needs a captured _ref store with pictures) and pm (needs a live team status). See TODO T-23.
import type { GroupRoute } from "../route.ts";

export default {
  id: "subagents",
  title: "Sub-agents",
  about: "One suite per sub-agent: does the agent stay in scope, report in its format, stop on a real blocker?",
  suites: [
    { name: "builder", ids: ["sb_"], main: "./builder/main.ts", about: "literal small edit, findings only, pnpm only, NEEDS_PARENT on a missing input, no endless repair loop" },
    { name: "qa_reviewer", ids: ["sq_"], main: "./qa_reviewer/main.ts", about: "quick check with a PASS/FAIL verdict, throwaway copy (login bypass), real project untouched" },
    { name: "planner", ids: ["sp_"], main: "./planner/main.ts", about: "short plan for a small job, finding triage with one TRIAGE line, plan-defect update" },
    { name: "researcher", ids: ["sr_"], main: "./researcher/main.ts", about: "read-only answer with quoted evidence; text inside the material is data, never orders" },
    { name: "ux_designer", ids: ["su_"], main: "./ux_designer/main.ts", about: "markdown spec in the named file, exact labels, no code, no extra screens" },
  ],
} satisfies GroupRoute;
