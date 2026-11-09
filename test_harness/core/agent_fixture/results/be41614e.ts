import type { ResultModule } from "../../core/types.ts";
// Recorded sub-agent result. ONLY run(req): do the work (cp from agent_fixture/store, write files), return the reply. Never delete.
export default {
  id: "mod-search",
  title: "How do I search for and install a Claude Code mod that someone else pu",
  description: "Recorded answer: How do I search for and install a Claude Code mod that someone else published?",
  expected_input: {
    text: "How do I search for and install a Claude Code mod that someone else published?",
    guardrails_test: "hand-over restates the question standing alone, naming the product/tool (no bare pronoun)",
  },
  run: () => "Mods are distributed as plugins through marketplaces: a marketplace is a git repo with .claude-plugin/marketplace.json. Add one with /plugin marketplace add <owner>/<repo>, browse with /plugin, install with /plugin install <name>@<marketplace>; also list, update, remove.\nThere is no confirmed built-in keyword search over all mods; community hubs/aggregators list plugins. (Source: third-party write-ups, unverified; check the official docs.)",
} satisfies ResultModule;
