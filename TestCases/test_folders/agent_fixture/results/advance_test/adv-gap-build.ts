import type { ResultModule } from "@core/types.ts";
// Recorded builder answer of the advance_test suite (test_folders/advance_test/main.ts). The work is in store/advance/stages.ts. Never delete.
import { build } from "../../store/advance/stages.ts";
export default {
  id: "adv-gap-build",
  title: "builder: slugify-gap build (GAPPY first build: no trim, no accents, 1 test)",
  description: "Builds slugify in slugify-gap: gappy",
  match: { agent: "builder", keywords: ["slugify-gap"], after: "adv-gap-plan" },
  expected_input: { text: "Build run_test/slugify-gap exactly as its PLAN.md says.", guardrails_test: "hand-over must name run_test, the folder and plan.md (carry the plan); only served after the plan" },
  run: (req) => build(req, "slugify-gap", "gappy"),
} satisfies ResultModule;
