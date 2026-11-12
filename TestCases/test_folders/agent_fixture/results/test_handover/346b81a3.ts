import type { ResultModule } from "@core/types.ts";
// Recorded sub-agent result. ONLY run(req): do the work (cp from agent_fixture/store, write files), return the reply. Never delete.
export default {
  id: "h1",
  title: "How does OpenClaw's Gateway route an incoming message to an agent sess",
  description: "Recorded answer: How does OpenClaw's Gateway route an incoming message to an agent session and run the agent loop?",
  expected_input: {
    text: "How does OpenClaw's Gateway route an incoming message to an agent session and run the agent loop?",
    guardrails_test: "hand-over restates the question standing alone, naming the product/tool (no bare pronoun)",
  },
  run: () => "The Gateway is one long-running process (default loopback port 18789) that owns messaging surfaces and client connections.\nFlow: incoming request -> mapped to a session -> context built -> agent loop runs against the configured model -> tool results feed back into the loop until the task finishes.\nThe Gateway host owns the live session database.\n(Source: third-party write-ups, unverified against docs.openclaw.ai.)",
} satisfies ResultModule;
