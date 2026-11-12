import type { ResultModule } from "@core/types.ts";
// Recorded expo-go result (test_expo_go case with the same id): ONLY run(req), the work is in store/expo_go/apply.ts. Never delete.
import { applyPhase } from "../../store/expo_go/apply.ts";
export default {
  id: "role-expo-go-eg_lintab_03_66e5453",
  title: "expo-go: linear-tab-bar phase 3/10 (66e5453)",
  description: "Applies the real commit 66e5453 \"Created serch input animation with closing button\" of github SchroederNathan/linear-tab-bar: App.tsx, src/components/TabBar/CloseSearchButton.tsx, src/components/TabBar/GlassMaterial.tsx, src/components/TabBar/SearchButton.tsx, src/components/TabBar/TabBar.tsx, src/components/TabBar/TabBarPill.tsx, src/components/TabBar/TabIcon.tsx, src/constants/layout.ts, src/constants/theme.ts, src/hooks/useTabBarAnimation.ts",
  match: { agent: "expo-go", keywords: ["linear","phase 3 of 10"] },
  expected_input: { text: "Phase 3 of 10. Add the search interaction: tapping the search button expands it into a search input that takes over the bar (animated), with a close button.", guardrails_test: "hand-over must contain [\"linear\",\"phase 3 of 10\"] plus run_test and PLAN.md (store/expo_go_rules.json), >= 120 chars" },
  run: (req) => applyPhase(req, {"name":"linear-tab-bar","n":3,"dir":"linear","skills":["expo-native-ui","expo-animation"],"expo_go":"ok","blockers":[]}),
} satisfies ResultModule;
