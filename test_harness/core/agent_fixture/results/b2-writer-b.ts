import type { ResultModule } from "../../core/types.ts";
// Recorded sub-agent result. ONLY run(req): do the work (cp from agent_fixture/store, write files), return the reply. Never delete.
export default {
  id: "b2-writer-b",
  title: "Create a markdown file b.md that contains the word Beta",
  description: "Recorded work: Create a markdown file b.md that contains the word Beta",
  match: {"agent":"writer","keywords":["b.md"]},
  expected_input: {
    text: "Create a markdown file b.md that contains the word Beta",
    guardrails_test: "hand-over names the file b.md",
  },
  run: (req) => {
    req.write("b.md", "Beta\n");
    return "Created b.md with the word: Beta";
  },
} satisfies ResultModule;
