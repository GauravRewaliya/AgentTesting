// results/68c44d07.ts - recorded sub-agent result. Do not delete: it is what saves sub-agent tokens.
import { execFileSync } from "node:child_process";
export default {
  id: "role-qa-reviewer",
  role: "qa-reviewer",
  title: "qa-reviewer: runs real file/dependency checks on the built folder",
  description: "Mock work of the qa-reviewer role: runs real file/dependency checks on the built folder",
  expected_input: {
    text: "(role call: qa-reviewer)",
    guardrails_test: "hand-over must contain ['test_run'], >= 40 chars, after ['builder']",
  },
  output: {
    script: ({ handover }: { handover: string }) =>
      execFileSync("python3", ["-I", "test_cases/_lib/mock_roles.py", "qa-reviewer"], { input: handover, encoding: "utf8" }).trimEnd(),
  },
};
