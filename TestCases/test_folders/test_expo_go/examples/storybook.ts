// REF: github.com/expo/examples/tree/master/with-storybook (pinned 2cc7a44). History = on-device Storybook of 2019, a v7 rewrite and SDK bumps, so ONE snapshot phase: build the example directly in its latest form.
// Plain cases (one object each, no generator). Fixtures: agent_fixture/results/test_expo_go/role-expo-go-<id>.ts. Cases with `after` continue in the workspace the earlier case left.
import type { Case } from "@core/types.ts";
import { expoGo } from "../lib/shared.ts";

export const cases: Case[] = [
  {
    ...expoGo,
    id: "eg_sb_01_0073f46",
    title: "[ref expo/examples/with-storybook] phase 1/1 · snapshot of the latest 0073f46 (2026-07-02) \"with-storybook at the latest Expo SDK (state of 0073f46: Upgraded Expo\"",
    turns: [{
      user: "Starting point: fixture with-storybook (the state the developer started this step from; it is set up in run_test/sb-app for you). Phase 1 of 1. Create an Expo app with Storybook 7 (web): .storybook config, an App.js, a Button and a Gradient component (expo-linear-gradient) each with a stories file, a Configure.mdx, the storybook and build-storybook scripts, and a .gitignore. Write/extend PLAN.md for this phase first, then do it, then tell me what changed. Work only in run_test/sb-app.",
      allowed: ["expo-go"],
      expected: {
        context: "Phase 1/1 = a SNAPSHOT of the project at its latest version (no history, upgrades ignored on purpose) \"with-storybook at the latest Expo SDK (state of 0073f46: Upgraded Expo SDK to `expo@latest` (#701))\". The lead calls expo-go ONCE (nothing else, no own work). The hand-over must carry: run_test/sb-app, PLAN.md, \"Phase 1 of 1\", the task and the fixture with-storybook. Recorded result role-expo-go-eg_sb_01_0073f46 applies the diff TestCases/test_folders/agent_fixture/store/expo_go/patches/with-storybook/01_0073f46.patch (files: with-storybook/.gitignore, with-storybook/.storybook/main.js, with-storybook/.storybook/preview.js, with-storybook/App.js, with-storybook/app.json, with-storybook/package.json, with-storybook/stories/Button.jsx, with-storybook/stories/Button.stories.js, with-storybook/stories/Configure.mdx, with-storybook/stories/Gradient.jsx, with-storybook/stories/Gradient.stories.js, with-storybook/stories/assets/accessibility.svg, with-storybook/stories/assets/discord.svg, with-storybook/stories/assets/github.svg, with-storybook/stories/assets/tutorials.svg, with-storybook/stories/assets/youtube.svg). Work required: 16 files (images excluded): .storybook/main.js + preview.js, App.js, app.json, .gitignore, package.json (scripts storybook / build-storybook; @storybook 7.4 devDependencies; expo ^57.0.1, expo-linear-gradient ~57.0.0, RN 0.86.0, react-native-web), stories/Button.jsx + Button.stories.js, Gradient.jsx + Gradient.stories.js, Configure.mdx, stories/assets/*.svg. The stories are web Storybook; Expo Go itself only runs App.js. Judge: the hand-over is enough for a sub-agent to do exactly this phase (not later phases); the lead reports the REPORT line (expo_go=ok) honestly and stops. Files in run_test/sb-app must equal the real commit's result.",
        expected_agents_res: ["role-expo-go-eg_sb_01_0073f46"],
      },
    }],
  },
];
