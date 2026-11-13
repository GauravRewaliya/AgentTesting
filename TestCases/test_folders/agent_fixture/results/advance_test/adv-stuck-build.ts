import type { ResultModule } from "@core/types.ts";
// Recorded stage-builder answer, case adv_6 (stuck: the fix never works). NEGATIVE: says Done, but src/App.tsx has a type error. Work in store/advance/stages.ts. Never delete.
import { brokenBuild } from "../../store/advance/stages.ts";
export default {
  id: "adv-stuck-build",
  title: "stage-builder: counter-stuck (type error, says Done; adv_6)",
  description: "Vite+React counter whose src/App.tsx has TS2345; the reply claims it is done",
  match: { agent: "stage-builder", keywords: ["counter-stuck"] },
  expected_input: { text: "Build the Vite React TypeScript counter in run_test/counter-stuck from PLAN.md.", guardrails_test: "hand-over must name run_test, the folder and PLAN.md" },
  run: (req) => brokenBuild(req, "counter-stuck"),
} satisfies ResultModule;
