import type { ResultModule } from "@core/types.ts";
// Recorded planner answer of the advance_test suite (test_folders/Cases/core_testing/advance_test/main.ts). The work is in store/advance/stages.ts. Never delete.
import { plan } from "../../store/advance/stages.ts";
export default {
  id: "adv-ok-plan",
  title: "planner: slugify-ok plan",
  description: "Writes slugify-ok/PLAN.md with 4 acceptance checks",
  match: { agent: "planner", keywords: ["slugify-ok"] },
  expected_input: { text: "Plan a slugify function in run_test/slugify-ok (src/slugify.ts + tests).", guardrails_test: "hand-over must name run_test and the folder" },
  run: (req) => plan(req, "slugify-ok"),
} satisfies ResultModule;
