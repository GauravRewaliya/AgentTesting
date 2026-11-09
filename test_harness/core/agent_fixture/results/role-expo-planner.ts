import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ResultModule } from "../../core/types.ts";
// Recorded sub-agent result. ONLY run(req): do the work (cp from agent_fixture/store, write files), return the reply. Never delete.
export default {
  id: "role-expo-planner",
  title: "planner: writes notes-app/plan.md",
  description: "Recorded work of the Expo team planner: plan.md for a drawer + zustand app from github.com/expo/examples",
  match: { agent: "planner", keywords: ["drawer", "zustand"] },
  expected_input: { text: "Plan the Expo app: drawer navigation plus a zustand store, based on expo/examples, in run_test", guardrails_test: "hand-over must contain ['expo/examples', 'drawer', 'zustand', 'run_test'], >= 150 chars, after []" },
  run: (req) => {
    const sdk = JSON.parse(readFileSync(join(req.store, "expo_examples/with-drawer-navigation/package.json"), "utf8")).dependencies?.expo;
    req.write("notes-app/plan.md", `# Plan: notes-app (Expo Go)
Task size: long
Goal: a small Expo app with drawer navigation whose screens share one list through a zustand store.
Sources (github.com/expo/examples): with-drawer-navigation (App.js, package.json), with-zustand (App.js, store.js, package.json)
Expo SDK in the drawer example: ${sdk}
Steps: 1 ux-designer writes the wireframe at the real paths. 2 builder replaces it with the original example code. 3 qa-reviewer checks.
Files: notes-app/App.js, notes-app/store.js, notes-app/package.json
Risks: the two examples were written for different dependency sets; merge package.json deps.
`);
    return "PLAN READY\npath: run_test/notes-app/plan.md\nTask size: long\nsources: with-drawer-navigation, with-zustand\nsteps: wireframe -> build (replace with original code) -> qa";
  },
} satisfies ResultModule;
