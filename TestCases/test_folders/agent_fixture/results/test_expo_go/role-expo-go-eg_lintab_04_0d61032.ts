import type { ResultModule } from "@core/types.ts";
// Recorded expo-go result (test_expo_go case with the same id): ONLY run(req), the work is in store/expo_go/apply.ts. Never delete.
import { applyPhase } from "../../store/expo_go/apply.ts";
export default {
  id: "role-expo-go-eg_lintab_04_0d61032",
  title: "expo-go: linear-tab-bar phase 4/10 (0d61032)",
  description: "Applies the real commit 0d61032 \"Fixed hold glow on glass material\" of github SchroederNathan/linear-tab-bar: src/hooks/usePillGestures.ts",
  match: { agent: "expo-go", keywords: ["linear","phase 4 of 10"] },
  expected_input: { text: "Phase 4 of 10. Fix: the glow stays visible while the pill is held; it must fade correctly.", guardrails_test: "hand-over must contain [\"linear\",\"phase 4 of 10\"] plus run_test and PLAN.md (store/expo_go_rules.json), >= 120 chars" },
  run: (req) => applyPhase(req, {"name":"linear-tab-bar","n":4,"dir":"linear","skills":["expo-native-ui","expo-animation"],"expo_go":"ok","blockers":[]}),
} satisfies ResultModule;
