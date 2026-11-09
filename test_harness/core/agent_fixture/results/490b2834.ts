import type { ResultModule } from "../../core/types.ts";
// Recorded sub-agent result. ONLY run(req): do the work (cp from agent_fixture/store, write files), return the reply. Never delete.
export default {
  id: "h2",
  title: "When does OpenClaw spawn a sub-agent with sessions_spawn and what stay",
  description: "Recorded answer: When does OpenClaw spawn a sub-agent with sessions_spawn and what stays out of the parent's context?",
  expected_input: {
    text: "When does OpenClaw spawn a sub-agent with sessions_spawn and what stays out of the parent's context?",
    guardrails_test: "hand-over restates the question standing alone, naming the product/tool (no bare pronoun)",
  },
  run: () => "sessions_spawn starts a sub-agent in its own isolated session; /subagents is the debug/management command.\nPoint: intermediate work (searches, file reads) stays in the child session; only the child's result returns to the parent.\nNested spawning is configurable; leaf agents do not get spawn tools automatically.\n(Source: third-party write-ups, unverified.)",
} satisfies ResultModule;
