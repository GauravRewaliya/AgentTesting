import type { ResultModule } from "@core/types.ts";
// Recorded builder answer of the advance_test suite (test_folders/Cases/core_testing/advance_test/main.ts). The work is in store/advance/stages.ts. Never delete.
import { fix } from "../../store/advance/stages.ts";
export default {
  id: "adv-gap-fix",
  title: "builder: slugify-gap FIX (closes the review findings)",
  description: "Rewrites slugify with trimming, NFD accents and 3 tests",
  match: { agent: "builder", keywords: ["slugify-gap"], after: "adv-gap-review" },
  expected_input: { text: "Fix the findings F1 F2 F3 of the review in run_test/slugify-gap.", guardrails_test: "hand-over must name run_test, the folder, plan.md and carry the findings; only served after the review" },
  run: (req) => fix(req, "slugify-gap"),
} satisfies ResultModule;
