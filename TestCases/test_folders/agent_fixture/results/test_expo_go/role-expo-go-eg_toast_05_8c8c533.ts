import type { ResultModule } from "@core/types.ts";
// Recorded expo-go result (test_expo_go case with the same id): ONLY run(req), the work is in store/expo_go/apply.ts. Never delete.
import { applyPhase } from "../../store/expo_go/apply.ts";
export default {
  id: "role-expo-go-eg_toast_05_8c8c533",
  title: "expo-go: enzo-clerk-toast phase 5/9 (8c8c533)",
  description: "Applies the real commit 8c8c533 \"replace runOnJS with scheduleOnRN and runOnUI with scheduleOnUI (#2)\" of github enzomanuelmangano/demos src/animations/clerk-toast: src/animations/clerk-toast/src/hook.tsx, src/animations/clerk-toast/src/stacked-toast-manager/backdrop/index.android.tsx, src/animations/clerk-toast/src/stacked-toast-manager/backdrop/index.tsx, src/animations/clerk-toast/src/stacked-toast-manager/context.ts, src/animations/clerk-toast/src/stacked-toast-manager/stacked-toast-provider.tsx, src/animations/clerk-toast/src/stacked-toast-manager/stacked-toast.tsx",
  match: { agent: "expo-go", keywords: ["clerk-toast","phase 5 of 9"] },
  expected_input: { text: "Phase 5 of 9. Move from runOnJS/runOnUI to scheduleOnRN/scheduleOnUI (react-native-worklets API) everywhere in the demo.", guardrails_test: "hand-over must contain [\"clerk-toast\",\"phase 5 of 9\"] plus run_test and PLAN.md (store/expo_go_rules.json), >= 120 chars" },
  run: (req) => applyPhase(req, {"name":"enzo-clerk-toast","n":5,"dir":"clerk-toast","skills":["expo-animation"],"expo_go":"ok","blockers":[]}),
} satisfies ResultModule;
