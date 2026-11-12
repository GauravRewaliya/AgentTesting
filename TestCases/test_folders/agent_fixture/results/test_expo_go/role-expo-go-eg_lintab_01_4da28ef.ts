import type { ResultModule } from "@core/types.ts";
// Recorded expo-go result (test_expo_go case with the same id): ONLY run(req), the work is in store/expo_go/apply.ts. Never delete.
import { applyPhase } from "../../store/expo_go/apply.ts";
export default {
  id: "role-expo-go-eg_lintab_01_4da28ef",
  title: "expo-go: linear-tab-bar phase 1/10 (4da28ef)",
  description: "Applies the real commit 4da28ef \"Initial commit. Linear style tab bar\" of github SchroederNathan/linear-tab-bar: App.tsx, app.json, babel.config.js, src/components/Screens/PlaceholderScreen.tsx, src/components/TabBar/GlassMaterial.tsx, src/components/TabBar/NotificationDot.tsx, src/components/TabBar/SearchButton.tsx, src/components/TabBar/TabBar.tsx, src/components/TabBar/TabBarPill.tsx, src/components/TabBar/TabIcon.js, src/components/TabBar/TabIcon.tsx, src/constants/layout.ts, src/constants/theme.ts, src/hooks/useKeyboardAnimation.ts, src/hooks/useTabBarAnimation.js, src/hooks/useTabBarAnimation.ts, tsconfig.json, package.json",
  match: { agent: "expo-go", keywords: ["linear","phase 1 of 10"] },
  expected_input: { text: "Phase 1 of 10. Build a Linear-style floating tab bar: a pill with 4 icon tabs and a round search button next to it, glass-looking background (GlassMaterial), notification dot, 4 placeholder screens, wired in App.tsx.", guardrails_test: "hand-over must contain [\"linear\",\"phase 1 of 10\"] plus run_test and PLAN.md (store/expo_go_rules.json), >= 120 chars" },
  run: (req) => applyPhase(req, {"name":"linear-tab-bar","n":1,"dir":"linear","skills":["expo-native-ui","expo-animation"],"expo_go":"ok","blockers":[]}),
} satisfies ResultModule;
