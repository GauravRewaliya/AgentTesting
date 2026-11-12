import type { ResultModule } from "@core/types.ts";
// Recorded expo-go result (test_expo_go case with the same id): ONLY run(req), the work is in store/expo_go/apply.ts. Never delete.
import { applyPhase } from "../../store/expo_go/apply.ts";
export default {
  id: "role-expo-go-eg_solarin_02_7371b88",
  title: "expo-go: solarin-my-app phase 2/3 (7371b88)",
  description: "Applies the real commit 7371b88 \"feat: enhance Rotate3d component; add support for dynamic front and back content, improve flipping logic, and integrate animated styles\" of expo.dev/demos/solarin-johnson -> Solarin-Johnson/my-app: app/3d-rotate/index.tsx, components/3dRotate.tsx",
  match: { agent: "expo-go", keywords: ["my-app","phase 2 of 3"] },
  expected_input: { text: "Phase 2 of 3. Make Rotate3d usable: it takes dynamic front and back content, exposes an imperative handle (flip, flipTo('front'|'back')), uses animated styles for the flip. Then build the screen on top of it: a 'Flip Card' front with a forward button and a back with a back button, themed text, bounce-pressable buttons, a form-like layout (inputs, a slider).", guardrails_test: "hand-over must contain [\"my-app\",\"phase 2 of 3\"] plus run_test and PLAN.md (store/expo_go_rules.json), >= 120 chars" },
  run: (req) => applyPhase(req, {"name":"solarin-my-app","n":2,"dir":"my-app","skills":["expo-router","expo-animation"],"expo_go":"ok","blockers":[]}),
} satisfies ResultModule;
