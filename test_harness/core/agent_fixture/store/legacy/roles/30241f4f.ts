// results/30241f4f.ts - recorded sub-agent result. Do not delete: it is what saves sub-agent tokens.
import { execFileSync } from "node:child_process";
export default {
  id: "role-ux-designer",
  role: "ux-designer",
  title: "ux-designer: writes the wireframe pseudo code at the real paths (App.js, store.js, wireframe.md) from real example lines",
  description: "Mock work of the ux-designer role: writes the wireframe pseudo code at the real paths (App.js, store.js, wireframe.md) from real example lines",
  expected_input: {
    text: "(role call: ux-designer)",
    guardrails_test: "hand-over must contain ['plan.md', 'wireframe', 'drawer', 'zustand', 'test_run'], >= 250 chars, after ['planner']",
  },
  output: {
    script: ({ handover }: { handover: string }) =>
      execFileSync("python3", ["-I", "test_cases/_lib/mock_roles.py", "ux-designer"], { input: handover, encoding: "utf8" }).trimEnd(),
  },
};
