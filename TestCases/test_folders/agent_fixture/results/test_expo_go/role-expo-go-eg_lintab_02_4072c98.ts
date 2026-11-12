import type { ResultModule } from "@core/types.ts";
// Recorded expo-go result (test_expo_go case with the same id): ONLY run(req), the work is in store/expo_go/apply.ts. Never delete.
import { applyPhase } from "../../store/expo_go/apply.ts";
export default {
  id: "role-expo-go-eg_lintab_02_4072c98",
  title: "expo-go: linear-tab-bar phase 2/10 (4072c98)",
  description: "Applies the real commit 4072c98 \"Created custom drag stretch and glow implementation\" of github SchroederNathan/linear-tab-bar: App.tsx, src/components/TabBar/SearchButton.tsx, src/components/TabBar/TabBar.tsx, src/components/TabBar/TabBarPill.tsx, src/components/TabBar/TabIcon.tsx, src/constants/theme.ts, src/hooks/usePillGestures.ts, src/hooks/useSearchGestures.ts",
  match: { agent: "expo-go", keywords: ["linear","phase 2 of 10"] },
  expected_input: { text: "Phase 2 of 10. Make the pill draggable: dragging across it stretches it and moves a glow under the finger; extract gesture hooks (usePillGestures, useSearchGestures) and a theme constants file.", guardrails_test: "hand-over must contain [\"linear\",\"phase 2 of 10\"] plus run_test and PLAN.md (store/expo_go_rules.json), >= 120 chars" },
  run: (req) => applyPhase(req, {"name":"linear-tab-bar","n":2,"dir":"linear","skills":["expo-native-ui","expo-animation"],"expo_go":"ok","blockers":[]}),
} satisfies ResultModule;
