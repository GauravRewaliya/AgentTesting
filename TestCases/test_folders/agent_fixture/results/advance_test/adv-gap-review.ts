import type { ResultModule } from "@core/types.ts";
// Recorded qa-reviewer answer of the advance_test suite (test_folders/advance_test/main.ts). The work is in store/advance/stages.ts. Never delete.
import { review } from "../../store/advance/stages.ts";
export default {
  id: "adv-gap-review",
  title: "qa-reviewer: slugify-gap review (finds 3 findings)",
  description: "Really reads slugify-gap/src files and raises F1 F2 F3",
  match: { agent: "qa-reviewer", keywords: ["slugify-gap"], after: "adv-gap-build" },
  expected_input: { text: "Review run_test/slugify-gap against its PLAN.md.", guardrails_test: "hand-over must name run_test and the folder; only served after the build" },
  run: (req) => review(req, "slugify-gap"),
} satisfies ResultModule;
