import type { ResultModule } from "@core/types.ts";
// Recorded expo-go result (test_expo_go case with the same id): ONLY run(req), the work is in store/expo_go/apply.ts. Never delete.
import { applyModule } from "../../store/expo_go/apply.ts";
export default {
  id: "role-expo-go-eg_folio_03_story",
  title: "expo-go: folio module 3/5 (story)",
  description: "Single-commit repo: writes the PLAN.md section and the honest verdict for src/story/*, src/director/*",
  match: { agent: "expo-go", keywords: ["folio-go","phase 3 of 5"] },
  expected_input: { text: "Phase 3 of 5. Read src/story and src/director (anim, world, showreel) and build a plain Reanimated version of the chapter/scene sequence: scene index, 'dive deeper' pinch gesture, chapter card; no GPU.", guardrails_test: "hand-over must contain [\"folio-go\",\"phase 3 of 5\"] plus run_test and PLAN.md" },
  run: (req) => applyModule(req, {"name":"folio-popup-book","n":3,"N":5,"dir_src":"folio-src","dir_out":"folio-go","title":"story + director","files":"src/story/*, src/director/*","skills":["expo-dev-client","expo-animation"],"expo_go":"ok","blockers":[]}),
} satisfies ResultModule;
