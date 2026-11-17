import type { ResultModule } from "@core/types.ts";
// Recorded builder answer of the advance_test suite, case adv_3 (context loss between stages, loopferry TESTING_REPORT 5.20). The work is in store/advance/stages.ts. Never delete.
import { copyBuild } from "../../store/advance/stages.ts";
export default {
  id: "adv-ctx-build",
  title: "builder: copy-demo (plain copy of index.html)",
  description: "Copies index.html to index2.html",
  match: { agent: "builder", keywords: ["copy-demo"] },
  expected_input: { text: "Make a backup copy of run_test/copy-demo/index.html as index2.html.", guardrails_test: "hand-over must name run_test and the folder and carry plan.md-like notes" },
  run: (req) => copyBuild(req, "copy-demo"),
} satisfies ResultModule;
