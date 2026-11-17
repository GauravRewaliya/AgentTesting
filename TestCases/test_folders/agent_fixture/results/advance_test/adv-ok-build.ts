import type { ResultModule } from "@core/types.ts";
// Recorded builder answer of the advance_test suite (test_folders/advance_test/main.ts). The work is in store/advance/stages.ts. Never delete.
import { build } from "../../store/advance/stages.ts";
export default {
  id: "adv-ok-build",
  title: "builder: slugify-ok build (complete build)",
  description: "Builds slugify in slugify-ok: complete",
  match: { agent: "builder", keywords: ["slugify-ok"], after: "adv-ok-plan" },
  expected_input: { text: "Build run_test/slugify-ok exactly as its PLAN.md says.", guardrails_test: "hand-over must name run_test, the folder and plan.md (carry the plan); only served after the plan" },
  run: (req) => build(req, "slugify-ok", "good"),
} satisfies ResultModule;
