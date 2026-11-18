import type { ResultModule } from "@core/types.ts";
// Recorded sub-agent result. ONLY run(req): do the work (cp from agent_fixture/store, write files), return the reply. Never delete.
export default {
  id: "h6",
  title: "What does running each OpenHands agent session in a Docker container i",
  description: "Recorded answer: What does running each OpenHands agent session in a Docker container isolate?",
  match: {"agent":"researcher"},   // the answering agent: the harness serves this result only for a researcher call (strict agent match)
  expected_input: {
    text: "What does running each OpenHands agent session in a Docker container isolate?",
    guardrails_test: "hand-over restates the question standing alone, naming the product/tool (no bare pronoun)",
  },
  run: () => "The filesystem, network and shell of the session are separated from the host. A bad command hurts the container, not the developer machine.\n(Source: AIMultiple, unverified against OpenHands docs.)",
} satisfies ResultModule;
