import type { ResultModule } from "@core/types.ts";
// Recorded builder answer, case adv_5 (a broken app the lead must catch with qa_check). NEGATIVE: says Done, but src/App.tsx has a type error. Work in store/advance/stages.ts. Never delete.
import { brokenBuild } from "../../store/advance/stages.ts";
export default {
  id: "adv-broken-build",
  title: "builder: counter-bad (type error, says Done)",
  description: "Vite+React counter whose src/App.tsx has TS2345; the reply claims it is done",
  match: { agent: "builder", keywords: ["counter-bad"] },
  expected_input: { text: "Build the Vite React TypeScript counter in run_test/counter-bad from PLAN.md.", guardrails_test: "hand-over must name run_test, the folder and PLAN.md" },
  run: (req) => brokenBuild(req, "counter-bad"),
} satisfies ResultModule;
