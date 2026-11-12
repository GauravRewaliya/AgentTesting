// results/9578649b.ts - recorded sub-agent result. Do not delete: it is what saves sub-agent tokens.
import { execFileSync } from "node:child_process";
export default {
  id: "role-poet",
  role: "poet",
  title: "poet: useless: a poem",
  description: "Mock work of the poet role: useless: a poem",
  expected_input: {
    text: "(role call: poet)",
    guardrails_test: "FORBIDDEN, calling it must stop the run",
  },
  output: {
    script: ({ handover }: { handover: string }) =>
      execFileSync("python3", ["-I", "test_cases/_lib/mock_roles.py", "poet"], { input: handover, encoding: "utf8" }).trimEnd(),
  },
};
