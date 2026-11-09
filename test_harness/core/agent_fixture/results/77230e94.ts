import type { ResultModule } from "../../core/types.ts";
// Recorded sub-agent result. ONLY run(req): do the work (cp from agent_fixture/store, write files), return the reply. Never delete.
export default {
  id: "h5",
  title: "OpenCode has a plan agent and a build agent: when should I use each",
  description: "Recorded answer: OpenCode has a plan agent and a build agent: when should I use each?",
  expected_input: {
    text: "OpenCode has a plan agent and a build agent: when should I use each?",
    guardrails_test: "hand-over restates the question standing alone, naming the product/tool (no bare pronoun)",
  },
  run: () => "plan = read-only, scopes the change and proposes steps; build = full tools, edits files.\nUse plan first for unfamiliar or large changes, then switch to build. Skip plan for one-line fixes.\n(Source: AIMultiple harness benchmark, unverified.)",
} satisfies ResultModule;
