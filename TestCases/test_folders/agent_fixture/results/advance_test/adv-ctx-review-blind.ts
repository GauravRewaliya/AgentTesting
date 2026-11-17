import type { ResultModule } from "@core/types.ts";
// Recorded qa-reviewer answer of the advance_test suite, case adv_3 (context loss between stages, loopferry TESTING_REPORT 5.20). The work is in store/advance/stages.ts. Never delete.
import { reviewCopy } from "../../store/advance/stages.ts";
export default {
  id: "adv-ctx-review-blind",
  title: "qa-reviewer: copy-demo review WITHOUT the request (harmful finding)",
  description: "The hand-over of the lead did not carry the user intent (the word backup): the reviewer calls index2.html an unrequested duplicate",
  match: { agent: "qa-reviewer", keywords: ["copy-demo"], after: "adv-ctx-build" },
  expected_input: { text: "Review run_test/copy-demo.", guardrails_test: "served when the hand-over lacks the word backup: this is the failure the case must NOT produce" },
  run: (req) => reviewCopy(req, "copy-demo", false),
} satisfies ResultModule;
