import type { ResultModule } from "@core/types.ts";
// Recorded expo-go result (test_expo_go case with the same id): ONLY run(req), the work is in store/expo_go/apply.ts. Never delete.
import { applyPhase } from "../../store/expo_go/apply.ts";
export default {
  id: "role-expo-go-eg_lintab_08_8e22f6b",
  title: "expo-go: linear-tab-bar phase 8/10 (8e22f6b)",
  description: "Applies the real commit 8e22f6b \"Added proper linear gradient masked border for fake glass effect\" of github SchroederNathan/linear-tab-bar: src/components/TabBar/GlassMaterial.tsx, src/constants/theme.ts",
  match: { agent: "expo-go", keywords: ["linear","phase 8 of 10"] },
  expected_input: { text: "Phase 8 of 10. Give the glass background a real border: a linear-gradient border drawn through a masked view, replacing the plain View border sheen.", guardrails_test: "hand-over must contain [\"linear\",\"phase 8 of 10\"] plus run_test and PLAN.md (store/expo_go_rules.json), >= 120 chars" },
  run: (req) => applyPhase(req, {"name":"linear-tab-bar","n":8,"dir":"linear","skills":["expo-native-ui","expo-animation"],"expo_go":"ok","blockers":[]}),
} satisfies ResultModule;
