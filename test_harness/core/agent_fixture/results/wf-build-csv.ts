import type { ResultModule } from "../../core/types.ts";
// Recorded sub-agent result. ONLY run(req): do the work (cp from agent_fixture/store, write files), return the reply. Never delete.
export default {
  id: "wf-build-csv",
  title: "Build CSV export from the approved plan",
  description: "Recorded work: Build CSV export from the approved plan",
  match: { agent: "builder", keywords: ["csv", "plan.md"] },
  expected_input: {
    text: "Implement the CSV export following the approved plan in plan.md.",
    guardrails_test: "hand-over names plan.md and the approval",
  },
  run: (req) => {
    req.write("orders/export.ts", "export const toCsv = (rows: Record<string, string>[]) =>\n  rows.map((r) => Object.values(r).map((v) => `\"${v.replaceAll('\"', '\"\"')}\"`).join(\",\")).join(\"\\n\");\n");
    return "Implemented plan.md: orders/export.ts with toCsv (quotes escaped). The Export button is still to do.";
  },
} satisfies ResultModule;
