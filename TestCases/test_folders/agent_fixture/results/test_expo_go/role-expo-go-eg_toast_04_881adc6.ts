import type { ResultModule } from "@core/types.ts";
// Recorded expo-go result (test_expo_go case with the same id): ONLY run(req), the work is in store/expo_go/apply.ts. Never delete.
import { applyPhase } from "../../store/expo_go/apply.ts";
export default {
  id: "role-expo-go-eg_toast_04_881adc6",
  title: "expo-go: enzo-clerk-toast phase 4/9 (881adc6)",
  description: "Applies the real commit 881adc6 \"refactor: animated.SharedValue\" of github enzomanuelmangano/demos src/animations/clerk-toast: src/animations/clerk-toast/src/stacked-toast-manager/stacked-toast.tsx",
  match: { agent: "expo-go", keywords: ["clerk-toast","phase 4 of 9"] },
  expected_input: { text: "Phase 4 of 9. Type refactor: use the Animated.SharedValue type in the stacked toast instead of the old one.", guardrails_test: "hand-over must contain [\"clerk-toast\",\"phase 4 of 9\"] plus run_test and PLAN.md (store/expo_go_rules.json), >= 120 chars" },
  run: (req) => applyPhase(req, {"name":"enzo-clerk-toast","n":4,"dir":"clerk-toast","skills":["expo-animation"],"expo_go":"ok","blockers":[]}),
} satisfies ResultModule;
