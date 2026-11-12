import type { ResultModule } from "@core/types.ts";
// Recorded expo-go result (test_expo_go case with the same id): ONLY run(req), the work is in store/expo_go/apply.ts. Never delete.
import { applyPhase } from "../../store/expo_go/apply.ts";
export default {
  id: "role-expo-go-eg_lintab_07_c5a53ac",
  title: "expo-go: linear-tab-bar phase 7/10 (c5a53ac)",
  description: "Applies the real commit c5a53ac \"when dragging the pill up, the menu triggers\" of github SchroederNathan/linear-tab-bar: App.tsx, src/hooks/usePillGestures.ts",
  match: { agent: "expo-go", keywords: ["linear","phase 7 of 10"] },
  expected_input: { text: "Phase 7 of 10. Dragging the pill upward past a threshold (-50 px) opens the menu.", guardrails_test: "hand-over must contain [\"linear\",\"phase 7 of 10\"] plus run_test and PLAN.md (store/expo_go_rules.json), >= 120 chars" },
  run: (req) => applyPhase(req, {"name":"linear-tab-bar","n":7,"dir":"linear","skills":["expo-native-ui","expo-animation"],"expo_go":"ok","blockers":[]}),
} satisfies ResultModule;
