import type { ResultModule } from "@core/types.ts";
// Recorded sub-agent result. ONLY run(req): do the work (cp from agent_fixture/store, write files), return the reply. Never delete.
export default {
  id: "h7",
  title: "Which open-source harness uses an architect/editor split between two m",
  description: "Recorded answer: Which open-source harness uses an architect/editor split between two models and how does it work?",
  match: {"agent":"researcher"},   // the answering agent: the harness serves this result only for a researcher call (strict agent match)
  expected_input: {
    text: "Which open-source harness uses an architect/editor split between two models and how does it work?",
    guardrails_test: "hand-over restates the question standing alone, naming the product/tool (no bare pronoun)",
  },
  run: () => "One model designs the change (architect), a second applies it as concrete edits (editor).\nCaution: one source credits Codex CLI; this mode is documented for Aider (--architect). Verify before relying on it.\n(Source: AIMultiple + general knowledge.)",
} satisfies ResultModule;
