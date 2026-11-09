import type { ResultModule } from "../../core/types.ts";
// Recorded sub-agent result. ONLY run(req): do the work (cp from agent_fixture/store, write files), return the reply. Never delete.
export default {
  id: "basic-reviewer-hi",
  title: "Check the file hi.md",
  description: "Recorded work: Check the file hi.md",
  match: {"agent":"reviewer","keywords":["hi.md"]},
  expected_input: {
    text: "Check the file hi.md",
    guardrails_test: "hand-over names the file hi.md",
  },
  run: () => "Reviewed hi.md: it contains the message Hi. Correct.",
} satisfies ResultModule;
