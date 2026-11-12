// results/19bacd42.ts - recorded sub-agent result. Do not delete: it is what saves sub-agent tokens.
import { execFileSync } from "node:child_process";
export default {
  id: "role-release-notes-writer",
  role: "release-notes-writer",
  title: "release-notes-writer: useless: release notes",
  description: "Mock work of the release-notes-writer role: useless: release notes",
  expected_input: {
    text: "(role call: release-notes-writer)",
    guardrails_test: "FORBIDDEN, calling it must stop the run",
  },
  output: {
    script: ({ handover }: { handover: string }) =>
      execFileSync("python3", ["-I", "test_cases/_lib/mock_roles.py", "release-notes-writer"], { input: handover, encoding: "utf8" }).trimEnd(),
  },
};
