import type { ResultModule } from "@core/types.ts";
// Recorded qa-reviewer answer of the advance_test suite, case adv_3 (context loss between stages, loopferry TESTING_REPORT 5.20). The work is in store/advance/stages.ts. Never delete.
import { reviewCopy } from "../../store/advance/stages.ts";
export default {
  id: "adv-ctx-review-aware",
  title: "qa-reviewer: copy-demo review WITH the request (approves)",
  description: "The hand-over said it is a backup: the reviewer compares the two files and approves",
  match: { agent: "qa-reviewer", keywords: ["copy-demo", "backup"], after: "adv-ctx-build" },
  expected_input: { text: "Review run_test/copy-demo: index2.html is the backup the user asked for.", guardrails_test: "hand-over must carry the user intent (the word backup)" },
  run: (req) => reviewCopy(req, "copy-demo", true),
} satisfies ResultModule;
