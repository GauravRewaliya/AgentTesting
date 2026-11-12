import type { ResultModule } from "@core/types.ts";
// Recorded sub-agent result. ONLY run(req): do the work (cp from agent_fixture/store, write files), return the reply. Never delete.
export default {
  id: "b2-writer-a",
  title: "Create a markdown file a.md that contains the word Alpha",
  description: "Recorded work: Create a markdown file a.md that contains the word Alpha",
  match: {"agent":"writer","keywords":["a.md"]},
  expected_input: {
    text: "Create a markdown file a.md that contains the word Alpha",
    guardrails_test: "hand-over names the file a.md",
  },
  run: (req) => {
    req.write("a.md", "Alpha\n");
    return "Created a.md with the word: Alpha";
  },
} satisfies ResultModule;
