// results/5f5e41a4.ts - recorded sub-agent result. Do not delete: it is what saves sub-agent tokens.
import { execFileSync } from "node:child_process";
export default {
  id: "role-builder",
  role: "builder",
  title: "builder: cp-replaces the wireframe with the original expo/examples code and merges package.json",
  description: "Mock work of the builder role: cp-replaces the wireframe with the original expo/examples code and merges package.json",
  expected_input: {
    text: "(role call: builder)",
    guardrails_test: "hand-over must contain ['wireframe', 'plan.md', 'with-drawer-navigation', 'with-zustand', 'test_run'], >= 200 chars, after ['planner', 'ux-designer']",
  },
  output: {
    script: ({ handover }: { handover: string }) =>
      execFileSync("python3", ["-I", "test_cases/_lib/mock_roles.py", "builder"], { input: handover, encoding: "utf8" }).trimEnd(),
  },
};
