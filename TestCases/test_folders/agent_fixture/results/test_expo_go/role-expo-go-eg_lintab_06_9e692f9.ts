import type { ResultModule } from "@core/types.ts";
// Recorded expo-go result (test_expo_go case with the same id): ONLY run(req), the work is in store/expo_go/apply.ts. Never delete.
import { applyPhase } from "../../store/expo_go/apply.ts";
export default {
  id: "role-expo-go-eg_lintab_06_9e692f9",
  title: "expo-go: linear-tab-bar phase 6/10 (9e692f9)",
  description: "Applies the real commit 9e692f9 \"Dragging the pill now doesnt change the routed tab until letting go\" of github SchroederNathan/linear-tab-bar: App.tsx, src/components/TabBar/GlassMaterial.tsx, src/components/TabBar/TabBar.tsx, src/components/TabBar/TabBarPill.tsx, src/components/TabBar/TabIcon.tsx, src/constants/layout.ts, src/hooks/usePillGestures.ts",
  match: { agent: "expo-go", keywords: ["linear","phase 6 of 10"] },
  expected_input: { text: "Phase 6 of 10. Dragging the pill must not change the routed tab until the finger is released; show the hovered tab while dragging.", guardrails_test: "hand-over must contain [\"linear\",\"phase 6 of 10\"] plus run_test and PLAN.md (store/expo_go_rules.json), >= 120 chars" },
  run: (req) => applyPhase(req, {"name":"linear-tab-bar","n":6,"dir":"linear","skills":["expo-native-ui","expo-animation"],"expo_go":"ok","blockers":[]}),
} satisfies ResultModule;
