import type { ResultModule } from "@core/types.ts";
// Recorded sub-agent result. ONLY run(req): do the work (cp from agent_fixture/store, write files), return the reply. Never delete.
export default {
  id: "h3",
  title: "How does Hermes Agent's delegate_task limit child agents' toolsets, co",
  description: "Recorded answer: How does Hermes Agent's delegate_task limit child agents' toolsets, concurrency and budget?",
  match: {"agent":"researcher"},   // the answering agent: the harness serves this result only for a researcher call (strict agent match)
  expected_input: {
    text: "How does Hermes Agent's delegate_task limit child agents' toolsets, concurrency and budget?",
    guardrails_test: "hand-over restates the question standing alone, naming the product/tool (no bare pronoun)",
  },
  run: () => "delegate_task starts child agents, each with its own context, terminal and iteration budget (default reported: 50) and a restricted toolset.\nDefault concurrency reported: 3 children at once, configurable. The parent collects the results.\n(Source: tutorials/wiki, unverified against the NousResearch/hermes-agent repo.)",
} satisfies ResultModule;
