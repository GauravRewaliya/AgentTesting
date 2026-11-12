import type { ResultModule } from "@core/types.ts";
// Recorded sub-agent result. ONLY run(req): do the work (cp from agent_fixture/store, write files), return the reply. Never delete.
export default {
  id: "mod-ship",
  title: "How do I validate, test and share a Claude Code mod I wrote",
  description: "Recorded answer: How do I validate, test and share a Claude Code mod I wrote?",
  expected_input: {
    text: "How do I validate, test and share a Claude Code mod I wrote?",
    guardrails_test: "hand-over restates the question standing alone, naming the product/tool (no bare pronoun)",
  },
  run: () => "Validate: claude plugin validate <mod folder> (manifest + module source as the engine will read it). Type-check: tsc -p <mod folder> once the engine has laid the types. Test: write a *.test.ts and run claude plugin test <mod folder>.\nShare: put .claude-plugin/marketplace.json in the repository and tell users to run /plugin install <mod> --marketplace <owner>/<repo>.\n(Source: plugin-authoring guidance of this build.)",
} satisfies ResultModule;
