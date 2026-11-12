import type { ResultModule } from "@core/types.ts";
// Recorded expo-go result (test_expo_go case with the same id): ONLY run(req), the work is in store/expo_go/apply.ts. Never delete.
import { applyPhase } from "../../store/expo_go/apply.ts";
export default {
  id: "role-expo-go-eg_toast_03_94b0327",
  title: "expo-go: enzo-clerk-toast phase 3/9 (94b0327)",
  description: "Applies the real commit 94b0327 \"fix: status bar handling\" of github enzomanuelmangano/demos src/animations/clerk-toast: src/animations/clerk-toast/src/index.tsx",
  match: { agent: "expo-go", keywords: ["clerk-toast","phase 3 of 9"] },
  expected_input: { text: "Phase 3 of 9. Fix the status bar handling in the demo's main screen.", guardrails_test: "hand-over must contain [\"clerk-toast\",\"phase 3 of 9\"] plus run_test and PLAN.md (store/expo_go_rules.json), >= 120 chars" },
  run: (req) => applyPhase(req, {"name":"enzo-clerk-toast","n":3,"dir":"clerk-toast","skills":["expo-animation"],"expo_go":"ok","blockers":[]}),
} satisfies ResultModule;
