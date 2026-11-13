import type { ResultModule } from "@core/types.ts";
// Recorded expo-go result (test_expo_go case with the same id): ONLY run(req), the work is in store/expo_go/apply.ts. Never delete.
import { applyPhase } from "../../store/expo_go/apply.ts";
export default {
  id: "role-expo-go-eg_solarin_01_754eb25",
  title: "expo-go: solarin-my-app phase 1/3 (754eb25)",
  description: "Applies the real commit 754eb25 \"feat: add 3D Rotate feature; implement Rotate3d component with flip animation and integrate into navigation\" of expo.dev/demos/solarin-johnson -> Solarin-Johnson/my-app: app/3d-rotate/_layout.tsx, app/3d-rotate/index.tsx, app/_layout.tsx, components/3dRotate.tsx",
  // keywords are only "my-app" ON PURPOSE: the phase order is enforced by `after` (a lead that words the hand-over without "phase N of 3" must still be served; before it got FIXTURE NOT FOUND)
  match: { agent: "expo-go", keywords: ["my-app"] },
  expected_input: { text: "Phase 1 of 3. Add a '3D Rotate' screen: a route app/3d-rotate (own _layout with a Slot, index with a SafeAreaView) showing a reusable Rotate3d component (components/3dRotate.tsx) that flips between a front and a back with a Reanimated rotateY animation, and register the route in app/_layout.tsx.", guardrails_test: "hand-over must contain [\"my-app\",\"phase 1 of 3\"] plus run_test and PLAN.md (store/expo_go_rules.json), >= 120 chars" },
  run: (req) => applyPhase(req, {"name":"solarin-my-app","n":1,"dir":"my-app","skills":["expo-router","expo-animation"],"expo_go":"ok","blockers":[]}),
} satisfies ResultModule;
