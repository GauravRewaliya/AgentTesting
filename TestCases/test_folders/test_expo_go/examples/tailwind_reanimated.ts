// REF: github.com/expo/examples/tree/master/with-tailwindcss (pinned 2cc7a44). The example's history is only router/NativeWind rewrites and SDK bumps, so it is ONE snapshot phase (built directly at the latest SDK);
// the chain then grows that app in two small, realistic steps (its package.json already has react-native-reanimated + worklets). Steps 2 and 3 are not from a git history: their recorded results are hand-written.
// Plain cases (one object each, no generator). Fixtures: agent_fixture/results/test_expo_go/role-expo-go-<id>.ts. Cases with `after` continue in the workspace the earlier case left.
import type { Case } from "@core/types.ts";
import { expoGo } from "../lib/shared.ts";

export const cases: Case[] = [
  {
    ...expoGo,
    id: "eg_tw_01_0073f46",
    title: "[ref expo/examples/with-tailwindcss] phase 1/1 · snapshot of the latest 0073f46 (2026-07-02) \"with-tailwindcss at the latest Expo SDK (state of 0073f46: Upgraded Ex\"",
    turns: [{
      user: "Starting point: fixture with-tailwindcss (the state the developer started this step from; it is set up in run_test/tw-app for you). Phase 1 of 1. Create an Expo Router app styled with Tailwind through NativeWind (latest versions): a root layout, an index screen styled only with className, tw wrapper components for View/Text/Link/Image so className works, the Tailwind CSS entry file and the Metro/PostCSS setup. Write/extend PLAN.md for this phase first, then do it, then tell me what changed. Work only in run_test/tw-app.",
      allowed: ["expo-go"],
      expected: {
        context: "Phase 1/1 = a SNAPSHOT of the project at its latest version (no history, upgrades ignored on purpose) \"with-tailwindcss at the latest Expo SDK (state of 0073f46: Upgraded Expo SDK to `expo@latest` (#701))\". The lead calls expo-go ONCE (nothing else, no own work). The hand-over must carry: run_test/tw-app, PLAN.md, \"Phase 1 of 1\", the task and the fixture with-tailwindcss. Recorded result role-expo-go-eg_tw_01_0073f46 applies the diff TestCases/test_folders/agent_fixture/store/expo_go/patches/with-tailwindcss/01_0073f46.patch (files: with-tailwindcss/app.json, with-tailwindcss/metro.config.js, with-tailwindcss/nativewind-env.d.ts, with-tailwindcss/package.json, with-tailwindcss/postcss.config.mjs, with-tailwindcss/src/app/_layout.tsx, with-tailwindcss/src/app/index.tsx, with-tailwindcss/src/global.css, with-tailwindcss/src/tw/image.tsx, with-tailwindcss/src/tw/index.tsx, with-tailwindcss/tsconfig.json). Work required: 11 files: app.json (router plugins), package.json (expo ^57, expo-router ~57, nativewind 5.0.0-preview.2, react-native-css, @tailwindcss/postcss ^4, reanimated + worklets, expo-image/linking/constants/splash-screen/status-bar), metro.config.js, postcss.config.mjs, global.d.ts, nativewind-env.d.ts, tsconfig.json, src/global.css, src/app/_layout.tsx, src/app/index.tsx, src/tw/index.tsx, src/tw/image.tsx. No babel.config.js. nativewind 5 is a preview: say so. Expo Go ok. Judge: the hand-over is enough for a sub-agent to do exactly this phase (not later phases); the lead reports the REPORT line (expo_go=ok) honestly and stops. Files in run_test/tw-app must equal the real commit's result.",
        expected_agents_res: ["role-expo-go-eg_tw_01_0073f46"],
      },
    }],
  },
  {
    ...expoGo,
    id: "eg_tw_02_spring",
    after: "eg_tw_01_0073f46",
    title: "[ref expo/examples/with-tailwindcss] grow the app: a card that springs when pressed (Reanimated)",
    turns: [{
      user: "In run_test/tw-app make the index screen show a className-styled card that scales down to 0.95 while pressed and springs back on release (Reanimated). Change only what is needed, no new packages.",
      allowed: ["expo-go"],
      expected: {
        context: "The lead calls expo-go ONCE; the hand-over names the folder, the file and the single change (a sub-agent call has no memory; it must also say what already exists). Recorded result role-expo-go-eg_tw_02_spring. Work required: Only src/app/index.tsx changes: Animated.View + useSharedValue/withSpring on onPressIn/onPressOut, Pressable from @/tw, card styled with className. package.json untouched (react-native-reanimated is already there). The hand-over names run_test/tw-app, the file, and that no packages are added. Judge: hand-over enough; the lead relays REPORT expo_go=ok and any UNVERIFIED note honestly.",
        expected_agents_res: ["role-expo-go-eg_tw_02_spring"],
      },
    }],
  },
  {
    ...expoGo,
    id: "eg_tw_03_dark",
    after: "eg_tw_02_spring",
    title: "[ref expo/examples/with-tailwindcss] grow the app: a dark-mode toggle, nothing else",
    turns: [{
      user: "In run_test/tw-app add a dark-mode toggle button below the card on the index screen. Keep everything else as is.",
      allowed: ["expo-go"],
      expected: {
        context: "The lead calls expo-go ONCE; the hand-over names the folder, the file and the single change (a sub-agent call has no memory; it must also say what already exists). Recorded result role-expo-go-eg_tw_03_dark. Work required: Small diff in src/app/index.tsx only: a toggle (colour-scheme API checked against the NativeWind docs / expo-design-system skill, not guessed), dark: classes on background, card and text; spring animation and routing untouched; no new packages. The recorded reply flags its API as UNVERIFIED for the NativeWind 5 preview and the lead must relay that. Judge: hand-over enough; the lead relays REPORT expo_go=ok and any UNVERIFIED note honestly.",
        expected_agents_res: ["role-expo-go-eg_tw_03_dark"],
      },
    }],
  },
];
