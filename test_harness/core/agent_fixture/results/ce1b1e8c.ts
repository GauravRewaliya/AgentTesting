import type { ResultModule } from "../../core/types.ts";
// Recorded sub-agent result. ONLY run(req): do the work (cp from agent_fixture/store, write files), return the reply. Never delete.
export default {
  id: "h4",
  title: "In Hermes Agent, what is the difference between MEMORY.md and the SQLi",
  description: "Recorded answer: In Hermes Agent, what is the difference between MEMORY.md and the SQLite session history?",
  expected_input: {
    text: "In Hermes Agent, what is the difference between MEMORY.md and the SQLite session history?",
    guardrails_test: "hand-over restates the question standing alone, naming the product/tool (no bare pronoun)",
  },
  run: () => "MEMORY.md / USER.md = small curated persistent memory the agent keeps in prompt.\nSQLite session history with FTS5 = searchable archive, used to recall old sessions on demand without keeping them in context.\nSkills are separate: SKILL.md files under ~/.hermes/skills/, auto-created after complex tasks.\n(Source: secondary write-ups, unverified.)",
} satisfies ResultModule;
