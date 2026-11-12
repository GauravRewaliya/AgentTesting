import type { ResultModule } from "@core/types.ts";
// Recorded expo-go result (test_expo_go case with the same id): ONLY run(req), the work is in store/expo_go/apply.ts. Never delete.
import { applyPhase } from "../../store/expo_go/apply.ts";
export default {
  id: "role-expo-go-eg_toast_07_aac472e",
  title: "expo-go: enzo-clerk-toast phase 7/9 (aac472e)",
  description: "Applies the real commit aac472e \"fix: unstable animations (#36)\" of github enzomanuelmangano/demos src/animations/clerk-toast: src/animations/clerk-toast/src/index.tsx, src/animations/clerk-toast/src/stacked-toast-manager/stacked-toast.tsx",
  match: { agent: "expo-go", keywords: ["clerk-toast","phase 7 of 9"] },
  expected_input: { text: "Phase 7 of 9. Animations feel unstable when the list scrolls under a toast; fix it in the main screen.", guardrails_test: "hand-over must contain [\"clerk-toast\",\"phase 7 of 9\"] plus run_test and PLAN.md (store/expo_go_rules.json), >= 120 chars" },
  run: (req) => applyPhase(req, {"name":"enzo-clerk-toast","n":7,"dir":"clerk-toast","skills":["expo-animation"],"expo_go":"ok","blockers":[]}),
} satisfies ResultModule;
