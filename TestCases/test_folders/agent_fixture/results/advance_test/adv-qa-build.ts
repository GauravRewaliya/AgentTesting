import type { ResultModule } from "@core/types.ts";
// Recorded stage-builder answer of the advance_test suite, case adv_4 (browser QA with a recorded video). The work is in store/advance/stages.ts. Never delete.
import { qaBuild } from "../../store/advance/stages.ts";
export default {
  id: "adv-qa-build",
  title: "stage-builder: qa-demo page",
  description: "Writes qa-demo/index.html (input shows the slug, Clear button)",
  match: { agent: "stage-builder", keywords: ["qa-demo"] },
  expected_input: { text: "Build the slug demo page in run_test/qa-demo.", guardrails_test: "hand-over must name run_test, the folder and plan.md-like notes" },
  run: (req) => qaBuild(req, "qa-demo"),
} satisfies ResultModule;
