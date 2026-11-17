import type { ResultModule } from "@core/types.ts";
// Recorded qa-reviewer answer of the advance_test suite, case adv_4 (browser QA with a recorded video). The work is in store/advance/stages.ts. Never delete.
import { qaRecord } from "../../store/advance/stages.ts";
export default {
  id: "adv-qa-video",
  title: "qa-reviewer: records a REAL video of qa-demo in a Docker container",
  description: "Serves qa-demo in an isolated container (no network, read-only mount), types and clicks in headless Chromium, writes qa.webm + qa.png + qa.json under test_harness/.state/v1/<session>/store/qa",
  match: { agent: "qa-reviewer", keywords: ["qa-demo"], after: "adv-qa-build" },
  expected_input: { text: "QA the page in run_test/qa-demo in a browser and record a video.", guardrails_test: "hand-over must name run_test and the folder; only served after the build" },
  run: (req) => qaRecord(req, "qa-demo"),
} satisfies ResultModule;
