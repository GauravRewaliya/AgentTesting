import type { ResultModule } from "../../core/types.ts";
// Recorded sub-agent result. ONLY run(req): do the work (cp from agent_fixture/store, write files), return the reply. Never delete.
export default {
  id: "basic-writer-hi",
  title: "Create a markdown file hi.md with the message Hi",
  description: "Recorded work: Create a markdown file hi.md with the message Hi",
  match: {"agent":"writer","keywords":["hi.md"]},
  expected_input: {
    text: "Create a markdown file hi.md with the message Hi",
    guardrails_test: "hand-over names the file hi.md",
  },
  run: (req) => {
    req.write("hi.md", "Hi\n");
    return "Created hi.md with the message: Hi";
  },
} satisfies ResultModule;
