import type { ResultModule } from "../../core/types.ts";
// Recorded sub-agent result. ONLY run(req): do the work (cp from agent_fixture/store, write files), return the reply. Never delete.
export default {
  id: "h8",
  title: "Which harness fits an overnight batch of many parallel subagents",
  description: "Recorded answer: Which harness fits an overnight batch of many parallel subagents?",
  expected_input: {
    text: "Which harness fits an overnight batch of many parallel subagents?",
    guardrails_test: "hand-over restates the question standing alone, naming the product/tool (no bare pronoun)",
  },
  run: () => "One source says Claude Code can run tens to hundreds of subagents in a session (not open source). Open options: OpenClaw (isolated sessions via sessions_spawn) and Hermes Agent (delegate_task, default 3 parallel children, raisable).\nPick by: parallel cap, per-child isolation, cost per child. (Unverified, secondary sources.)",
} satisfies ResultModule;
