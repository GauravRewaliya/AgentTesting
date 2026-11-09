// results/d3c505ab.ts - recorded sub-agent result. Do not delete: it is what saves sub-agent tokens.
import { execFileSync } from "node:child_process";
export default {
  id: "role-package-researcher",
  role: "package-researcher",
  title: "package-researcher: answers zustand syntax/version questions and checks the builder's store.js",
  description: "Mock work of the package-researcher role: answers zustand syntax/version questions and checks the builder's store.js",
  expected_input: {
    text: "(role call: package-researcher)",
    guardrails_test: "hand-over must contain ['zustand', 'store.js'], >= 120 chars, after []",
  },
  output: {
    script: ({ handover }: { handover: string }) =>
      execFileSync("python3", ["-I", "test_cases/_lib/mock_roles.py", "package-researcher"], { input: handover, encoding: "utf8" }).trimEnd(),
  },
};
