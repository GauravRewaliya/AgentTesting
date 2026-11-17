import type { ResultModule } from "@core/types.ts";
// Recorded builder answer, case adv_5. POSITIVE: served only after adv-broken-build AND only when the hand-over carries the real error code (TS2345) from qa_check, so a lead that did not run the check cannot get it. Never delete.
import { brokenFix } from "../../store/advance/stages.ts";
export default {
  id: "adv-broken-fix",
  title: "builder: counter-bad fix (TS2345)",
  description: "Fixes src/App.tsx so the app type-checks and renders",
  match: { agent: "builder", keywords: ["counter-bad", "ts2345"], after: "adv-broken-build" },
  expected_input: { text: "run_test/counter-bad fails type check: src/App.tsx error TS2345. Fix it.", guardrails_test: "hand-over must name run_test, the folder, PLAN.md and the error" },
  run: (req) => brokenFix(req, "counter-bad"),
} satisfies ResultModule;
