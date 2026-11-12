import type { ResultModule } from "@core/types.ts";
// Recorded expo-go result (test_expo_go case with the same id): ONLY run(req), the work is in store/expo_go/apply.ts. Never delete.
import { applyPhase } from "../../store/expo_go/apply.ts";
export default {
  id: "role-expo-go-eg_lintab_09_3c78584",
  title: "expo-go: linear-tab-bar phase 9/10 (3c78584)",
  description: "Applies the real commit 3c78584 \"Optimize animation performance: remove dead worklets, deduplicate liquid glass, memoize gestures\" of github SchroederNathan/linear-tab-bar: App.tsx, src/components/TabBar/CloseSearchButton.tsx, src/components/TabBar/MenuPanel.tsx, src/components/TabBar/SearchButton.tsx, src/components/TabBar/TabBar.tsx, src/components/TabBar/TabBarPill.tsx, src/components/TabBar/TabIcon.tsx, src/hooks/usePillGestures.ts, src/hooks/useTabBarAnimation.ts, src/utils/liquidGlass.ts",
  match: { agent: "expo-go", keywords: ["linear","phase 9 of 10"] },
  expected_input: { text: "Phase 9 of 10. Performance pass: remove dead worklets, share one liquid-glass implementation (utils/liquidGlass.ts), memoize gestures.", guardrails_test: "hand-over must contain [\"linear\",\"phase 9 of 10\"] plus run_test and PLAN.md (store/expo_go_rules.json), >= 120 chars" },
  run: (req) => applyPhase(req, {"name":"linear-tab-bar","n":9,"dir":"linear","skills":["expo-native-ui","expo-animation"],"expo_go":"ok","blockers":[]}),
} satisfies ResultModule;
