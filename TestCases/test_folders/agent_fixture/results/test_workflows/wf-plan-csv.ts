import type { ResultModule } from "@core/types.ts";
// Recorded sub-agent result. ONLY run(req): do the work (cp from agent_fixture/store, write files), return the reply. Never delete.
export default {
  id: "wf-plan-csv",
  title: "Plan CSV export for the orders page (plan only)",
  description: "Recorded work: Plan CSV export for the orders page (plan only)",
  match: { agent: "planner", keywords: ["csv"] },
  expected_input: {
    text: "Plan a CSV export for the orders page. Plan only, no code.",
    guardrails_test: "hand-over says plan only / do not write code",
  },
  run: (req) => {
    req.write("plan.md", "# Plan: CSV export\n1. Add toCsv(rows) in orders/export.ts\n2. Add an Export button on the orders page\n3. Test: empty list, commas and quotes in fields\nRisks: large exports block the page; stream or cap rows.\nOpen question: which columns?\n");
    return "Plan written to plan.md: 3 steps, 1 risk, 1 open question (which columns). No code was written.";
  },
} satisfies ResultModule;
