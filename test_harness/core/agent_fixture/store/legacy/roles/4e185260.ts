// results/4e185260.ts - recorded sub-agent result. Do not delete: it is what saves sub-agent tokens.
import { execFileSync } from "node:child_process";
export default {
  id: "role-planner",
  role: "planner",
  title: "planner: writes test_run/notes-app/plan.md",
  description: "Mock work of the planner role: writes test_run/notes-app/plan.md",
  expected_input: {
    text: "(role call: planner)",
    guardrails_test: "hand-over must contain ['expo/examples', 'drawer', 'zustand', 'test_run'], >= 150 chars, after []",
  },
  output: {
    script: ({ handover }: { handover: string }) =>
      execFileSync("python3", ["-I", "test_cases/_lib/mock_roles.py", "planner"], { input: handover, encoding: "utf8" }).trimEnd(),
  },
};
