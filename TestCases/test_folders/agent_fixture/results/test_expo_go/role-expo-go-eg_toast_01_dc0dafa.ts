import type { ResultModule } from "@core/types.ts";
// Recorded expo-go result (test_expo_go case with the same id): ONLY run(req), the work is in store/expo_go/apply.ts. Never delete.
import { applyPhase } from "../../store/expo_go/apply.ts";
export default {
  id: "role-expo-go-eg_toast_01_dc0dafa",
  title: "expo-go: enzo-clerk-toast phase 1/9 (dc0dafa)",
  description: "Applies the real commit dc0dafa \"feat: patreon demos 2024 (#3)\" of github enzomanuelmangano/demos src/animations/clerk-toast: src/animations/clerk-toast/index.tsx, src/animations/clerk-toast/src/components/pressable-scale.tsx, src/animations/clerk-toast/src/hook.tsx, src/animations/clerk-toast/src/hooks/use-toast.tsx, src/animations/clerk-toast/src/index.tsx, src/animations/clerk-toast/src/stacked-toast-manager/backdrop/index.android.tsx, src/animations/clerk-toast/src/stacked-toast-manager/backdrop/index.tsx, src/animations/clerk-toast/src/stacked-toast-manager/backdrop/use-gradient-height.ts, src/animations/clerk-toast/src/stacked-toast-manager/constants.ts, src/animations/clerk-toast/src/stacked-toast-manager/context.ts, src/animations/clerk-toast/src/stacked-toast-manager/hooks.ts, src/animations/clerk-toast/src/stacked-toast-manager/index.ts, src/animations/clerk-toast/src/stacked-toast-manager/stacked-toast-provider.tsx, src/animations/clerk-toast/src/stacked-toast-manager/stacked-toast.tsx",
  match: { agent: "expo-go", keywords: ["clerk-toast","phase 1 of 9"] },
  expected_input: { text: "Phase 1 of 9. Build a stacked toast demo (Clerk-style): a StackedToastProvider with a useToast hook, toasts stacking with scale/offset, a backdrop gradient (separate Android file), a pressable-scale button to trigger toasts. Standalone Expo app, files like index.tsx, src/stacked-toast-manager/*, src/hooks/use-toast.tsx.", guardrails_test: "hand-over must contain [\"clerk-toast\",\"phase 1 of 9\"] plus run_test and PLAN.md (store/expo_go_rules.json), >= 120 chars" },
  run: (req) => applyPhase(req, {"name":"enzo-clerk-toast","n":1,"dir":"clerk-toast","skills":["expo-animation"],"expo_go":"ok","blockers":[]}),
} satisfies ResultModule;
