import type { ResultModule } from "@core/types.ts";
// Recorded sub-agent result. ONLY run(req): do the work (cp from agent_fixture/store, write files), return the reply. Never delete.
export default {
  id: "wf-review-signup",
  title: "Review of the signup validation",
  description: "Recorded work: Review of the signup validation",
  match: { agent: "reviewer", keywords: ["signup"] },
  expected_input: {
    text: "Review the signup validation change.",
    guardrails_test: "hand-over names the file signup/validate.ts and asks for findings",
  },
  run: () => "Verdict: CHANGES. Finding 1: the email check accepts \"a@b\" with no dot in the domain. Finding 2: no maximum password length (denial of service on hashing). Nothing else blocking.",
} satisfies ResultModule;
