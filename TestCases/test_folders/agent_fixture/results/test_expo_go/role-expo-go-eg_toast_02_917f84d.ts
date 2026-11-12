import type { ResultModule } from "@core/types.ts";
// Recorded expo-go result (test_expo_go case with the same id): ONLY run(req), the work is in store/expo_go/apply.ts. Never delete.
import { applyPhase } from "../../store/expo_go/apply.ts";
export default {
  id: "role-expo-go-eg_toast_02_917f84d",
  title: "expo-go: enzo-clerk-toast phase 2/9 (917f84d)",
  description: "Applies the real commit 917f84d \"refactor: replace pressables with pressto\" of github enzomanuelmangano/demos src/animations/clerk-toast: src/animations/clerk-toast/index.tsx, src/animations/clerk-toast/src/hook.tsx, src/animations/clerk-toast/src/index.tsx",
  match: { agent: "expo-go", keywords: ["clerk-toast","phase 2 of 9"] },
  expected_input: { text: "Phase 2 of 9. Replace the hand-made pressables with the `pressto` library (PressableScale) in the demo screen.", guardrails_test: "hand-over must contain [\"clerk-toast\",\"phase 2 of 9\"] plus run_test and PLAN.md (store/expo_go_rules.json), >= 120 chars" },
  run: (req) => applyPhase(req, {"name":"enzo-clerk-toast","n":2,"dir":"clerk-toast","skills":["expo-animation"],"expo_go":"ok","blockers":[]}),
} satisfies ResultModule;
