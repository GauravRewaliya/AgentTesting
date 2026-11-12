import type { ResultModule } from "@core/types.ts";
// Recorded expo-go result (test_expo_go case with the same id): ONLY run(req), the work is in store/expo_go/apply.ts. Never delete.
import { applyPhase } from "../../store/expo_go/apply.ts";
export default {
  id: "role-expo-go-eg_toast_09_bb5aea4",
  title: "expo-go: enzo-clerk-toast phase 9/9 (bb5aea4)",
  description: "Applies the real commit bb5aea4 \"style: improve shadows (#47)\" of github enzomanuelmangano/demos src/animations/clerk-toast: src/animations/clerk-toast/src/stacked-toast-manager/stacked-toast.tsx",
  match: { agent: "expo-go", keywords: ["clerk-toast","phase 9 of 9"] },
  expected_input: { text: "Phase 9 of 9. Improve the toast shadows.", guardrails_test: "hand-over must contain [\"clerk-toast\",\"phase 9 of 9\"] plus run_test and PLAN.md (store/expo_go_rules.json), >= 120 chars" },
  run: (req) => applyPhase(req, {"name":"enzo-clerk-toast","n":9,"dir":"clerk-toast","skills":["expo-animation"],"expo_go":"ok","blockers":[]}),
} satisfies ResultModule;
