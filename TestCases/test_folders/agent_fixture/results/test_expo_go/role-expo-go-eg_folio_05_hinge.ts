import type { ResultModule } from "@core/types.ts";
// Recorded expo-go result (test_expo_go case with the same id): ONLY run(req), the work is in store/expo_go/apply.ts. Never delete.
import { applyModule } from "../../store/expo_go/apply.ts";
export default {
  id: "role-expo-go-eg_folio_05_hinge",
  title: "expo-go: folio module 5/5 (hinge)",
  description: "Single-commit repo: writes the PLAN.md section and the honest verdict for modules/folio-hinge/*, plugins/withSceneLifecycle.js, app.json",
  match: { agent: "expo-go", keywords: ["folio-go","phase 5 of 5"] },
  expected_input: { text: "Phase 5 of 5. Make the book follow the phone's hinge angle: read modules/folio-hinge (Swift, UIHingeInteraction, iOS 27.1) and plugins/withSceneLifecycle.js, and make it work in the app I run in Expo Go.", guardrails_test: "hand-over must contain [\"folio-go\",\"phase 5 of 5\"] plus run_test and PLAN.md" },
  run: (req) => applyModule(req, {"name":"folio-popup-book","n":5,"N":5,"dir_src":"folio-src","dir_out":"folio-go","title":"native hinge module + plugin","files":"modules/folio-hinge/*, plugins/withSceneLifecycle.js, app.json","skills":["expo-dev-client","expo-animation"],"expo_go":"needs_dev_build","blockers":["modules/folio-hinge","plugins/withSceneLifecycle.js","react-native-webgpu"]}),
} satisfies ResultModule;
