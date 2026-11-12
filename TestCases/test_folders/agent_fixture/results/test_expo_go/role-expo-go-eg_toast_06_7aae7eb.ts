import type { ResultModule } from "@core/types.ts";
// Recorded expo-go result (test_expo_go case with the same id): ONLY run(req), the work is in store/expo_go/apply.ts. Never delete.
import { applyPhase } from "../../store/expo_go/apply.ts";
export default {
  id: "role-expo-go-eg_toast_06_7aae7eb",
  title: "expo-go: enzo-clerk-toast phase 6/9 (7aae7eb)",
  description: "Applies the real commit 7aae7eb \"fix: haptics with pressto (#26)\" of github enzomanuelmangano/demos src/animations/clerk-toast: src/animations/clerk-toast/_meta.json, src/animations/clerk-toast/index.tsx, src/animations/clerk-toast/src/hook.tsx, src/animations/clerk-toast/src/hooks/use-toast.tsx, src/animations/clerk-toast/src/index.tsx, src/animations/clerk-toast/src/stacked-toast-manager/backdrop/index.android.tsx, src/animations/clerk-toast/src/stacked-toast-manager/backdrop/index.tsx, src/animations/clerk-toast/src/stacked-toast-manager/backdrop/use-gradient-height.ts, src/animations/clerk-toast/src/stacked-toast-manager/context.ts, src/animations/clerk-toast/src/stacked-toast-manager/hooks.ts, src/animations/clerk-toast/src/stacked-toast-manager/stacked-toast-provider.tsx, src/animations/clerk-toast/src/stacked-toast-manager/stacked-toast.tsx",
  match: { agent: "expo-go", keywords: ["clerk-toast","phase 6 of 9"] },
  expected_input: { text: "Phase 6 of 9. Make the trigger buttons use pressto's glass pressable (PressableGlass with a clear glass effect) instead of PressableScale, and make sure the backdrop does not eat touches.", guardrails_test: "hand-over must contain [\"clerk-toast\",\"phase 6 of 9\"] plus run_test and PLAN.md (store/expo_go_rules.json), >= 120 chars" },
  run: (req) => applyPhase(req, {"name":"enzo-clerk-toast","n":6,"dir":"clerk-toast","skills":["expo-animation"],"expo_go":"ok","blockers":[]}),
} satisfies ResultModule;
