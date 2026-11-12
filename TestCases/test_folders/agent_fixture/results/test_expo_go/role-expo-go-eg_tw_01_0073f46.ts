import type { ResultModule } from "@core/types.ts";
// Recorded expo-go result (test_expo_go case with the same id): ONLY run(req), the work is in store/expo_go/apply.ts. Never delete.
import { applyPhase } from "../../store/expo_go/apply.ts";
export default {
  id: "role-expo-go-eg_tw_01_0073f46",
  title: "expo-go: with-tailwindcss phase 1/1 (0073f46)",
  description: "Builds the latest version \"with-tailwindcss at the latest Expo SDK (state of 0073f46: Upgraded Expo SDK to `expo@latest` (#701))\" of expo/examples/with-tailwindcss: with-tailwindcss/app.json, with-tailwindcss/metro.config.js, with-tailwindcss/nativewind-env.d.ts, with-tailwindcss/package.json, with-tailwindcss/postcss.config.mjs, with-tailwindcss/src/app/_layout.tsx, with-tailwindcss/src/app/index.tsx, with-tailwindcss/src/global.css, with-tailwindcss/src/tw/image.tsx, with-tailwindcss/src/tw/index.tsx, with-tailwindcss/tsconfig.json",
  match: { agent: "expo-go", keywords: ["tw-app","phase 1 of 1"] },
  expected_input: { text: "Phase 1 of 1. Create an Expo Router app styled with Tailwind through NativeWind (latest versions): a root layout, an index screen styled only with className, tw wrapper components for View/Text/Link/Image so className works, the Tailwind CSS entry file and the Metro/PostCSS setup.", guardrails_test: "hand-over must contain [\"tw-app\",\"phase 1 of 1\"] plus run_test and PLAN.md (store/expo_go_rules.json), >= 120 chars" },
  run: (req) => applyPhase(req, {"name":"with-tailwindcss","n":1,"dir":"tw-app","skills":["expo-router","expo-native-ui"],"expo_go":"ok","blockers":[]}),
} satisfies ResultModule;
