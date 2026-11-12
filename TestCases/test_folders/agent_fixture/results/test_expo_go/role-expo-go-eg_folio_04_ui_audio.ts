import type { ResultModule } from "@core/types.ts";
// Recorded expo-go result (test_expo_go case with the same id): ONLY run(req), the work is in store/expo_go/apply.ts. Never delete.
import { applyModule } from "../../store/expo_go/apply.ts";
export default {
  id: "role-expo-go-eg_folio_04_ui_audio",
  title: "expo-go: folio module 4/5 (ui_audio)",
  description: "Single-commit repo: writes the PLAN.md section and the honest verdict for src/ui/*, src/audio.ts, src/flags.ts",
  match: { agent: "expo-go", keywords: ["folio-go","phase 4 of 5"] },
  expected_input: { text: "Phase 4 of 5. Port src/ui, src/audio.ts and src/flags.ts: chapter card UI, expo-audio playback, expo-haptics, launch flags (showreel/mute/nohaptics) read from a JS config instead of iOS launch arguments.", guardrails_test: "hand-over must contain [\"folio-go\",\"phase 4 of 5\"] plus run_test and PLAN.md" },
  run: (req) => applyModule(req, {"name":"folio-popup-book","n":4,"N":5,"dir_src":"folio-src","dir_out":"folio-go","title":"ui, audio, flags","files":"src/ui/*, src/audio.ts, src/flags.ts","skills":["expo-dev-client","expo-animation"],"expo_go":"ok","blockers":[]}),
} satisfies ResultModule;
