import type { ResultModule } from "@core/types.ts";
// Recorded expo-go result (test_expo_go case with the same id): ONLY run(req), the work is in store/expo_go/apply.ts. Never delete.
import { applyModule } from "../../store/expo_go/apply.ts";
export default {
  id: "role-expo-go-eg_folio_02_art",
  title: "expo-go: folio module 2/5 (art)",
  description: "Single-commit repo: writes the PLAN.md section and the honest verdict for src/art/*",
  match: { agent: "expo-go", keywords: ["folio-go","phase 2 of 5"] },
  expected_input: { text: "Phase 2 of 5. Read src/art (atlas, brush, patterns.json, paint_*.ts) and port the 2D atlas/pattern drawing to a plain @shopify/react-native-skia canvas screen (no WebGPU).", guardrails_test: "hand-over must contain [\"folio-go\",\"phase 2 of 5\"] plus run_test and PLAN.md" },
  run: (req) => applyModule(req, {"name":"folio-popup-book","n":2,"N":5,"dir_src":"folio-src","dir_out":"folio-go","title":"paper art atlas","files":"src/art/*","skills":["expo-dev-client","expo-animation"],"expo_go":"ok","blockers":[]}),
} satisfies ResultModule;
