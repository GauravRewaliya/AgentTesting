import type { ResultModule } from "@core/types.ts";
// Recorded qa-reviewer answer of the advance_test suite (test_folders/advance_test/main.ts). The work is in store/advance/stages.ts. Never delete.
import { review } from "../../store/advance/stages.ts";
export default {
  id: "adv-ok-review",
  title: "qa-reviewer: slugify-ok review (approves)",
  description: "Really reads slugify-ok/src files and approves",
  match: { agent: "qa-reviewer", keywords: ["slugify-ok"], after: "adv-ok-build" },
  expected_input: { text: "Review run_test/slugify-ok against its PLAN.md.", guardrails_test: "hand-over must name run_test and the folder; only served after the build" },
  run: (req) => review(req, "slugify-ok"),
} satisfies ResultModule;
