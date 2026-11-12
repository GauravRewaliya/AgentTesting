import type { ResultModule } from "@core/types.ts";
// Recorded expo-go result (test_expo_go case with the same id): ONLY run(req), the work is in store/expo_go/apply.ts. Never delete.
import { applyPhase } from "../../store/expo_go/apply.ts";
export default {
  id: "role-expo-go-eg_toast_08_2837819",
  title: "expo-go: enzo-clerk-toast phase 8/9 (2837819)",
  description: "Applies the real commit 2837819 \"style: prefer spring animations (#39)\" of github enzomanuelmangano/demos src/animations/clerk-toast: src/animations/clerk-toast/src/stacked-toast-manager/backdrop/index.android.tsx, src/animations/clerk-toast/src/stacked-toast-manager/backdrop/index.tsx, src/animations/clerk-toast/src/stacked-toast-manager/stacked-toast.tsx",
  match: { agent: "expo-go", keywords: ["clerk-toast","phase 8 of 9"] },
  expected_input: { text: "Phase 8 of 9. Prefer spring animations over timing ones in the backdrop and the toast.", guardrails_test: "hand-over must contain [\"clerk-toast\",\"phase 8 of 9\"] plus run_test and PLAN.md (store/expo_go_rules.json), >= 120 chars" },
  run: (req) => applyPhase(req, {"name":"enzo-clerk-toast","n":8,"dir":"clerk-toast","skills":["expo-animation"],"expo_go":"ok","blockers":[]}),
} satisfies ResultModule;
