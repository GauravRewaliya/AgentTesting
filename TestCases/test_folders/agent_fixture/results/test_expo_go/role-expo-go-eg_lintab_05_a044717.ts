import type { ResultModule } from "@core/types.ts";
// Recorded expo-go result (test_expo_go case with the same id): ONLY run(req), the work is in store/expo_go/apply.ts. Never delete.
import { applyPhase } from "../../store/expo_go/apply.ts";
export default {
  id: "role-expo-go-eg_lintab_05_a044717",
  title: "expo-go: linear-tab-bar phase 5/10 (a044717)",
  description: "Applies the real commit a044717 \"Created custom popup menu animation\" of github SchroederNathan/linear-tab-bar: App.tsx, src/components/TabBar/GlassMaterial.tsx, src/components/TabBar/MenuPanel.tsx, src/components/TabBar/SearchButton.tsx, src/components/TabBar/TabBar.tsx, src/components/TabBar/TabBarPill.tsx, src/components/TabBar/TabIcon.tsx, src/constants/layout.ts, src/constants/theme.ts, src/hooks/useTabBarAnimation.ts",
  match: { agent: "expo-go", keywords: ["linear","phase 5 of 10"] },
  expected_input: { text: "Phase 5 of 10. Add a popup menu that opens above the bar with an animated panel (MenuPanel) and menu items.", guardrails_test: "hand-over must contain [\"linear\",\"phase 5 of 10\"] plus run_test and PLAN.md (store/expo_go_rules.json), >= 120 chars" },
  run: (req) => applyPhase(req, {"name":"linear-tab-bar","n":5,"dir":"linear","skills":["expo-native-ui","expo-animation"],"expo_go":"ok","blockers":[]}),
} satisfies ResultModule;
