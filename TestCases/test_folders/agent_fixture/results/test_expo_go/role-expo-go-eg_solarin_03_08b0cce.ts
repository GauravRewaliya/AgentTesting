import type { ResultModule } from "@core/types.ts";
// Recorded expo-go result (test_expo_go case with the same id): ONLY run(req), the work is in store/expo_go/apply.ts. Never delete.
import { applyPhase } from "../../store/expo_go/apply.ts";
export default {
  id: "role-expo-go-eg_solarin_03_08b0cce",
  title: "expo-go: solarin-my-app phase 3/3 (08b0cce)",
  description: "Applies the real commit 08b0cce \"feat: integrate DrawPad component for signature capture in BackContent; enhance user interaction with feedback on flip actions\" of expo.dev/demos/solarin-johnson -> Solarin-Johnson/my-app: app/3d-rotate/index.tsx, components/3dRotate.tsx, package.json",
  match: { agent: "expo-go", keywords: ["my-app","phase 3 of 3"] },
  expected_input: { text: "Phase 3 of 3. Make the back of the card a signature screen: add a drawing pad (the expo-drawpad package), let the reset icon clear it, and give soft haptic feedback when the card flips. Keep the 'Received by' field as it is.", guardrails_test: "hand-over must contain [\"my-app\",\"phase 3 of 3\"] plus run_test and PLAN.md (store/expo_go_rules.json), >= 120 chars" },
  run: (req) => applyPhase(req, {"name":"solarin-my-app","n":3,"dir":"my-app","skills":["expo-router","expo-animation"],"expo_go":"ok","blockers":[]}),
} satisfies ResultModule;
