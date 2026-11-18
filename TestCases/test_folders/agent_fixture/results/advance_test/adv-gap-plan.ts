import type { ResultModule } from "@core/types.ts";
// Recorded planner answer of the advance_test suite (test_folders/Cases/core_testing/advance_test/main.ts). The work is in store/advance/stages.ts. Never delete.
import { plan } from "../../store/advance/stages.ts";
export default {
  id: "adv-gap-plan",
  title: "planner: slugify-gap plan",
  description: "Writes slugify-gap/PLAN.md with 4 acceptance checks",
  match: { agent: "planner", keywords: ["slugify-gap"] },
  expected_input: { text: "Plan a slugify function in run_test/slugify-gap (src/slugify.ts + tests).", guardrails_test: "hand-over must name run_test and the folder" },
  run: (req) => plan(req, "slugify-gap"),
} satisfies ResultModule;
