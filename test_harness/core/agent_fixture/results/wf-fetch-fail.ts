import type { ResultModule } from "../../core/types.ts";
// Recorded sub-agent result. ONLY run(req): do the work (cp from agent_fixture/store, write files), return the reply. Never delete.
export default {
  id: "wf-fetch-fail",
  title: "A fetch that cannot succeed (blocked network)",
  description: "Recorded work: A fetch that cannot succeed (blocked network)",
  match: { agent: "researcher", keywords: ["pricing"] },
  expected_input: {
    text: "Read https://example.com/docs/pricing and summarise the pricing table.",
    guardrails_test: "hand-over carries the URL",
  },
  run: () => "ERROR: could not fetch https://example.com/docs/pricing (network blocked by the allow-list). No summary was produced and no file was written.",
} satisfies ResultModule;
