import type { ResultModule } from "@core/types.ts";
// Recorded expo-go result (test_expo_go case with the same id): ONLY run(req), the work is in store/expo_go/apply.ts. Never delete.
import { applyModule } from "../../store/expo_go/apply.ts";
export default {
  id: "role-expo-go-eg_folio_01_engine",
  title: "expo-go: folio module 1/5 (engine)",
  description: "Single-commit repo: writes the PLAN.md section and the honest verdict for src/engine/*",
  match: { agent: "expo-go", keywords: ["folio-go","phase 1 of 5"] },
  expected_input: { text: "Phase 1 of 5. Read src/engine (frame, gpu, math, render, shaders) and explain it; then say which of its packages run in Expo Go.", guardrails_test: "hand-over must contain [\"folio-go\",\"phase 1 of 5\"] plus run_test and PLAN.md" },
  run: (req) => applyModule(req, {"name":"folio-popup-book","n":1,"N":5,"dir_src":"folio-src","dir_out":"folio-go","title":"GPU engine","files":"src/engine/*","skills":["expo-dev-client","expo-animation"],"expo_go":"needs_dev_build","blockers":["react-native-webgpu","react-native-webgpu-dawn"]}),
} satisfies ResultModule;
