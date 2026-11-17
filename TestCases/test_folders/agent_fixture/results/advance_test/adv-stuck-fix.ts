import type { ResultModule } from "@core/types.ts";
// Recorded builder answer, case adv_6. The "fix" does NOT fix: the same TS2345 comes back, so qa_check fails with the SAME issue again (3 times in a row ends the QA loop and fails the test). Repeatable. Never delete.
import { stuckFix } from "../../store/advance/stages.ts";
export default {
  id: "adv-stuck-fix",
  title: "builder: counter-stuck 'fix' that changes nothing",
  description: "Changes nothing that matters; the type error stays. Matches ANY later hand-over about counter-stuck (a lead that words the error differently, or hands over the exact line, must get the same non-fix: the sub-agent really cannot do it)",
  match: { agent: "builder", keywords: ["counter-stuck"], after: "adv-stuck-build", repeatable: true },
  expected_input: { text: "run_test/counter-stuck fails type check: src/App.tsx error TS2345. Fix it.", guardrails_test: "hand-over must name run_test, the folder, PLAN.md and the error" },
  run: (req) => stuckFix(req, "counter-stuck"),
} satisfies ResultModule;
