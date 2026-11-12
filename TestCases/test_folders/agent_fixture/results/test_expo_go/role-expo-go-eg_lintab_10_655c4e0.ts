import type { ResultModule } from "@core/types.ts";
// Recorded expo-go result (test_expo_go case with the same id): ONLY run(req), the work is in store/expo_go/apply.ts. Never delete.
import { applyPhase } from "../../store/expo_go/apply.ts";
export default {
  id: "role-expo-go-eg_lintab_10_655c4e0",
  title: "expo-go: linear-tab-bar phase 10/10 (655c4e0)",
  description: "Applies the real commit 655c4e0 \"Simplified file structure and deleted unused keyboard animation file\" of github SchroederNathan/linear-tab-bar: App.tsx, app.json, src/components/Screens/PlaceholderScreen.tsx, src/components/TabBar/GlassMaterial.tsx, src/components/TabBar/MenuPanel.tsx, src/components/TabBar/SearchBar.tsx, src/components/TabBar/TabBarPill.tsx, src/components/TabBar/TabIcon.tsx, src/components/TabBar/constants.ts, src/components/TabBar/index.tsx",
  match: { agent: "expo-go", keywords: ["linear","phase 10 of 10"] },
  expected_input: { text: "Phase 10 of 10. Simplify the file structure: move to src/components/TabBar/{index,constants,SearchBar,MenuPanel,...}, delete the unused keyboard animation file, update imports.", guardrails_test: "hand-over must contain [\"linear\",\"phase 10 of 10\"] plus run_test and PLAN.md (store/expo_go_rules.json), >= 120 chars" },
  run: (req) => applyPhase(req, {"name":"linear-tab-bar","n":10,"dir":"linear","skills":["expo-native-ui","expo-animation"],"expo_go":"ok","blockers":[]}),
} satisfies ResultModule;
