// REF: https://github.com/enzomanuelmangano/demos -> src/animations/clerk-toast (one demo out of the collection; 9 of its 22 commits replayed). The whole repo is NOT Expo Go (modules/, nitro.json), this single demo is.
// Start state of phase 1 = empty folder (the demo did not exist before dc0dafa). Later phases are the real refactors/fixes in order; note the SDK drift between 2024 and 2025 commits: the agent must keep the package versions in package.json consistent.
// Plain cases (one object each, no generator). Fixtures: agent_fixture/results/test_expo_go/role-expo-go-<id>.ts. Cases with `after` continue in the workspace the earlier case left.
import type { Case } from "@core/types.ts";
import { expoGo } from "../lib/shared.ts";

export const cases: Case[] = [
  {
    ...expoGo,
    id: "eg_toast_01_dc0dafa",
    title: "[ref github enzomanuelmangano/demos src/animations/clerk-toast] phase 1/9 · commit dc0dafa (2024-09-03) \"feat: patreon demos 2024 (#3)\"",
    turns: [{
      user: "Starting point: fixture enzo-clerk-toast (the state the developer started this step from; it is set up in run_test/clerk-toast for you). Phase 1 of 9. Build a stacked toast demo (Clerk-style): a StackedToastProvider with a useToast hook, toasts stacking with scale/offset, a backdrop gradient (separate Android file), a pressable-scale button to trigger toasts. Standalone Expo app, files like index.tsx, src/stacked-toast-manager/*, src/hooks/use-toast.tsx. Write/extend PLAN.md for this phase first, then do it, then tell me what changed. Work only in run_test/clerk-toast.",
      allowed: ["expo-go"],
      expected: {
        context: "Phase 1/9 = real commit dc0dafa \"feat: patreon demos 2024 (#3)\". The lead calls expo-go ONCE (nothing else, no own work). The hand-over must carry: run_test/clerk-toast, PLAN.md, \"Phase 1 of 9\", the task and the fixture enzo-clerk-toast. Recorded result role-expo-go-eg_toast_01_dc0dafa applies the diff TestCases/test_folders/agent_fixture/store/expo_go/patches/enzo-clerk-toast/01_dc0dafa.patch (files: src/animations/clerk-toast/index.tsx, src/animations/clerk-toast/src/components/pressable-scale.tsx, src/animations/clerk-toast/src/hook.tsx, src/animations/clerk-toast/src/hooks/use-toast.tsx, src/animations/clerk-toast/src/index.tsx, src/animations/clerk-toast/src/stacked-toast-manager/backdrop/index.android.tsx, src/animations/clerk-toast/src/stacked-toast-manager/backdrop/index.tsx, src/animations/clerk-toast/src/stacked-toast-manager/backdrop/use-gradient-height.ts, src/animations/clerk-toast/src/stacked-toast-manager/constants.ts, src/animations/clerk-toast/src/stacked-toast-manager/context.ts, src/animations/clerk-toast/src/stacked-toast-manager/hooks.ts, src/animations/clerk-toast/src/stacked-toast-manager/index.ts, src/animations/clerk-toast/src/stacked-toast-manager/stacked-toast-provider.tsx, src/animations/clerk-toast/src/stacked-toast-manager/stacked-toast.tsx). Work required: 14 files (29 KB): index.tsx, src/{index,hook}.tsx, hooks/use-toast.tsx, components/pressable-scale.tsx, stacked-toast-manager/{backdrop/index.tsx, backdrop/index.android.tsx, use-gradient-height.ts, constants.ts, context.ts, hooks.ts, index.ts, stacked-toast-provider.tsx, stacked-toast.tsx}. Packages: reanimated, gesture-handler, safe-area-context, expo-linear-gradient, haptics -> Expo Go ok. The agent must not port the rest of the repo. Judge: the hand-over is enough for a sub-agent to do exactly this phase (not later phases); the lead reports the REPORT line (expo_go=ok) honestly and stops. Files in run_test/clerk-toast must equal the real commit's result.",
        expected_agents_res: ["role-expo-go-eg_toast_01_dc0dafa"],
      },
    }],
  },
  {
    ...expoGo,
    id: "eg_toast_02_917f84d",
    after: "eg_toast_01_dc0dafa",
    title: "[ref github enzomanuelmangano/demos src/animations/clerk-toast] phase 2/9 · commit 917f84d (2024-09-27) \"refactor: replace pressables with pressto\"",
    turns: [{
      user: "Phase 2 of 9. Replace the hand-made pressables with the `pressto` library (PressableScale) in the demo screen. Write/extend PLAN.md for this phase first, then do it, then tell me what changed. Work only in run_test/clerk-toast.",
      allowed: ["expo-go"],
      expected: {
        context: "Phase 2/9 = real commit 917f84d \"refactor: replace pressables with pressto\". The lead calls expo-go ONCE (nothing else, no own work). The hand-over must carry: run_test/clerk-toast, PLAN.md, \"Phase 2 of 9\", the task and what phases 1-1 already did (a sub-agent call has no memory). Recorded result role-expo-go-eg_toast_02_917f84d applies the diff TestCases/test_folders/agent_fixture/store/expo_go/patches/enzo-clerk-toast/02_917f84d.patch (files: src/animations/clerk-toast/index.tsx, src/animations/clerk-toast/src/hook.tsx, src/animations/clerk-toast/src/index.tsx). Work required: 2 files: src/hook.tsx, src/index.tsx; import cleanup (React imports), 'pressto' added to package.json. pressto is JS-only -> ok. NOTE: the patch is the net diff since the previous replayed phase, so it also folds 1 skipped commit(s) that touched this folder; its file list can be longer than the work text. Judge: the hand-over is enough for a sub-agent to do exactly this phase (not later phases); the lead reports the REPORT line (expo_go=ok) honestly and stops. Files in run_test/clerk-toast must equal the real commit's result.",
        expected_agents_res: ["role-expo-go-eg_toast_02_917f84d"],
      },
    }],
  },
  {
    ...expoGo,
    id: "eg_toast_03_94b0327",
    after: "eg_toast_02_917f84d",
    title: "[ref github enzomanuelmangano/demos src/animations/clerk-toast] phase 3/9 · commit 94b0327 (2024-11-06) \"fix: status bar handling\"",
    turns: [{
      user: "Phase 3 of 9. Fix the status bar handling in the demo's main screen. Write/extend PLAN.md for this phase first, then do it, then tell me what changed. Work only in run_test/clerk-toast.",
      allowed: ["expo-go"],
      expected: {
        context: "Phase 3/9 = real commit 94b0327 \"fix: status bar handling\". The lead calls expo-go ONCE (nothing else, no own work). The hand-over must carry: run_test/clerk-toast, PLAN.md, \"Phase 3 of 9\", the task and what phases 1-2 already did (a sub-agent call has no memory). Recorded result role-expo-go-eg_toast_03_94b0327 applies the diff TestCases/test_folders/agent_fixture/store/expo_go/patches/enzo-clerk-toast/03_94b0327.patch (files: src/animations/clerk-toast/src/index.tsx). Work required: ONE file, small: src/index.tsx. Anything else is scope creep. Judge: the hand-over is enough for a sub-agent to do exactly this phase (not later phases); the lead reports the REPORT line (expo_go=ok) honestly and stops. Files in run_test/clerk-toast must equal the real commit's result.",
        expected_agents_res: ["role-expo-go-eg_toast_03_94b0327"],
      },
    }],
  },
  {
    ...expoGo,
    id: "eg_toast_04_881adc6",
    after: "eg_toast_03_94b0327",
    title: "[ref github enzomanuelmangano/demos src/animations/clerk-toast] phase 4/9 · commit 881adc6 (2025-09-15) \"refactor: animated.SharedValue\"",
    turns: [{
      user: "Phase 4 of 9. Type refactor: use the Animated.SharedValue type in the stacked toast instead of the old one. Write/extend PLAN.md for this phase first, then do it, then tell me what changed. Work only in run_test/clerk-toast.",
      allowed: ["expo-go"],
      expected: {
        context: "Phase 4/9 = real commit 881adc6 \"refactor: animated.SharedValue\". The lead calls expo-go ONCE (nothing else, no own work). The hand-over must carry: run_test/clerk-toast, PLAN.md, \"Phase 4 of 9\", the task and what phases 1-3 already did (a sub-agent call has no memory). Recorded result role-expo-go-eg_toast_04_881adc6 applies the diff TestCases/test_folders/agent_fixture/store/expo_go/patches/enzo-clerk-toast/04_881adc6.patch (files: src/animations/clerk-toast/src/stacked-toast-manager/stacked-toast.tsx). Work required: ONE file: stacked-toast-manager/stacked-toast.tsx, a type change only. NOTE: the patch is the net diff since the previous replayed phase, so it also folds 1 skipped commit(s) that touched this folder; its file list can be longer than the work text. Judge: the hand-over is enough for a sub-agent to do exactly this phase (not later phases); the lead reports the REPORT line (expo_go=ok) honestly and stops. Files in run_test/clerk-toast must equal the real commit's result.",
        expected_agents_res: ["role-expo-go-eg_toast_04_881adc6"],
      },
    }],
  },
  {
    ...expoGo,
    id: "eg_toast_05_8c8c533",
    after: "eg_toast_04_881adc6",
    title: "[ref github enzomanuelmangano/demos src/animations/clerk-toast] phase 5/9 · commit 8c8c533 (2025-09-27) \"replace runOnJS with scheduleOnRN and runOnUI with scheduleOnUI (#2)\"",
    turns: [{
      user: "Phase 5 of 9. Move from runOnJS/runOnUI to scheduleOnRN/scheduleOnUI (react-native-worklets API) everywhere in the demo. Write/extend PLAN.md for this phase first, then do it, then tell me what changed. Work only in run_test/clerk-toast.",
      allowed: ["expo-go"],
      expected: {
        context: "Phase 5/9 = real commit 8c8c533 \"replace runOnJS with scheduleOnRN and runOnUI with scheduleOnUI (#2)\". The lead calls expo-go ONCE (nothing else, no own work). The hand-over must carry: run_test/clerk-toast, PLAN.md, \"Phase 5 of 9\", the task and what phases 1-4 already did (a sub-agent call has no memory). Recorded result role-expo-go-eg_toast_05_8c8c533 applies the diff TestCases/test_folders/agent_fixture/store/expo_go/patches/enzo-clerk-toast/05_8c8c533.patch (files: src/animations/clerk-toast/src/hook.tsx, src/animations/clerk-toast/src/stacked-toast-manager/backdrop/index.android.tsx, src/animations/clerk-toast/src/stacked-toast-manager/backdrop/index.tsx, src/animations/clerk-toast/src/stacked-toast-manager/context.ts, src/animations/clerk-toast/src/stacked-toast-manager/stacked-toast-provider.tsx, src/animations/clerk-toast/src/stacked-toast-manager/stacked-toast.tsx). Work required: 5 files: backdrop/index.tsx, backdrop/index.android.tsx, context.ts, stacked-toast-provider.tsx, stacked-toast.tsx. Requires react-native-worklets in package.json at the version matching the Reanimated of the SDK (check the expo-animation skill, do not invent a version). NOTE: the patch is the net diff since the previous replayed phase, so it also folds 1 skipped commit(s) that touched this folder; its file list can be longer than the work text. Judge: the hand-over is enough for a sub-agent to do exactly this phase (not later phases); the lead reports the REPORT line (expo_go=ok) honestly and stops. Files in run_test/clerk-toast must equal the real commit's result.",
        expected_agents_res: ["role-expo-go-eg_toast_05_8c8c533"],
      },
    }],
  },
  {
    ...expoGo,
    id: "eg_toast_06_7aae7eb",
    after: "eg_toast_05_8c8c533",
    title: "[ref github enzomanuelmangano/demos src/animations/clerk-toast] phase 6/9 · commit 7aae7eb (2025-10-14) \"fix: haptics with pressto (#26)\"",
    turns: [{
      user: "Phase 6 of 9. Make the trigger buttons use pressto's glass pressable (PressableGlass with a clear glass effect) instead of PressableScale, and make sure the backdrop does not eat touches. Write/extend PLAN.md for this phase first, then do it, then tell me what changed. Work only in run_test/clerk-toast.",
      allowed: ["expo-go"],
      expected: {
        context: "Phase 6/9 = real commit 7aae7eb \"fix: haptics with pressto (#26)\". The lead calls expo-go ONCE (nothing else, no own work). The hand-over must carry: run_test/clerk-toast, PLAN.md, \"Phase 6 of 9\", the task and what phases 1-5 already did (a sub-agent call has no memory). Recorded result role-expo-go-eg_toast_06_7aae7eb applies the diff TestCases/test_folders/agent_fixture/store/expo_go/patches/enzo-clerk-toast/06_7aae7eb.patch (files: src/animations/clerk-toast/_meta.json, src/animations/clerk-toast/index.tsx, src/animations/clerk-toast/src/hook.tsx, src/animations/clerk-toast/src/hooks/use-toast.tsx, src/animations/clerk-toast/src/index.tsx, src/animations/clerk-toast/src/stacked-toast-manager/backdrop/index.android.tsx, src/animations/clerk-toast/src/stacked-toast-manager/backdrop/index.tsx, src/animations/clerk-toast/src/stacked-toast-manager/backdrop/use-gradient-height.ts, src/animations/clerk-toast/src/stacked-toast-manager/context.ts, src/animations/clerk-toast/src/stacked-toast-manager/hooks.ts, src/animations/clerk-toast/src/stacked-toast-manager/stacked-toast-provider.tsx, src/animations/clerk-toast/src/stacked-toast-manager/stacked-toast.tsx). Work required: 2 files: src/index.tsx (PressableScale -> PressableGlass from 'pressto/glass', glassEffectStyle=\"clear\") and backdrop/index.tsx (pointerEvents: 'none'). Glass effects are iOS-26-style: the agent must check (expo-design-system / expo-native-ui skills) whether this runs in Expo Go and say what it could not verify. NOTE: the patch is the net diff since the previous replayed phase, so it also folds 3 skipped commit(s) that touched this folder; its file list can be longer than the work text. Judge: the hand-over is enough for a sub-agent to do exactly this phase (not later phases); the lead reports the REPORT line (expo_go=ok) honestly and stops. Files in run_test/clerk-toast must equal the real commit's result.",
        expected_agents_res: ["role-expo-go-eg_toast_06_7aae7eb"],
      },
    }],
  },
  {
    ...expoGo,
    id: "eg_toast_07_aac472e",
    after: "eg_toast_06_7aae7eb",
    title: "[ref github enzomanuelmangano/demos src/animations/clerk-toast] phase 7/9 · commit aac472e (2025-11-01) \"fix: unstable animations (#36)\"",
    turns: [{
      user: "Phase 7 of 9. Animations feel unstable when the list scrolls under a toast; fix it in the main screen. Write/extend PLAN.md for this phase first, then do it, then tell me what changed. Work only in run_test/clerk-toast.",
      allowed: ["expo-go"],
      expected: {
        context: "Phase 7/9 = real commit aac472e \"fix: unstable animations (#36)\". The lead calls expo-go ONCE (nothing else, no own work). The hand-over must carry: run_test/clerk-toast, PLAN.md, \"Phase 7 of 9\", the task and what phases 1-6 already did (a sub-agent call has no memory). Recorded result role-expo-go-eg_toast_07_aac472e applies the diff TestCases/test_folders/agent_fixture/store/expo_go/patches/enzo-clerk-toast/07_aac472e.patch (files: src/animations/clerk-toast/src/index.tsx, src/animations/clerk-toast/src/stacked-toast-manager/stacked-toast.tsx). Work required: ONE file, 2 lines: src/index.tsx swaps React Native's ScrollView for the one from react-native-gesture-handler. Judge that the agent finds a small, plausible cause (gesture conflict) and does not rewrite the toast manager; vague request -> it states its assumption. NOTE: the patch is the net diff since the previous replayed phase, so it also folds 3 skipped commit(s) that touched this folder; its file list can be longer than the work text. Judge: the hand-over is enough for a sub-agent to do exactly this phase (not later phases); the lead reports the REPORT line (expo_go=ok) honestly and stops. Files in run_test/clerk-toast must equal the real commit's result.",
        expected_agents_res: ["role-expo-go-eg_toast_07_aac472e"],
      },
    }],
  },
  {
    ...expoGo,
    id: "eg_toast_08_2837819",
    after: "eg_toast_07_aac472e",
    title: "[ref github enzomanuelmangano/demos src/animations/clerk-toast] phase 8/9 · commit 2837819 (2025-11-02) \"style: prefer spring animations (#39)\"",
    turns: [{
      user: "Phase 8 of 9. Prefer spring animations over timing ones in the backdrop and the toast. Write/extend PLAN.md for this phase first, then do it, then tell me what changed. Work only in run_test/clerk-toast.",
      allowed: ["expo-go"],
      expected: {
        context: "Phase 8/9 = real commit 2837819 \"style: prefer spring animations (#39)\". The lead calls expo-go ONCE (nothing else, no own work). The hand-over must carry: run_test/clerk-toast, PLAN.md, \"Phase 8 of 9\", the task and what phases 1-7 already did (a sub-agent call has no memory). Recorded result role-expo-go-eg_toast_08_2837819 applies the diff TestCases/test_folders/agent_fixture/store/expo_go/patches/enzo-clerk-toast/08_2837819.patch (files: src/animations/clerk-toast/src/stacked-toast-manager/backdrop/index.android.tsx, src/animations/clerk-toast/src/stacked-toast-manager/backdrop/index.tsx, src/animations/clerk-toast/src/stacked-toast-manager/stacked-toast.tsx). Work required: 3 files: backdrop/index.tsx, backdrop/index.android.tsx, stacked-toast.tsx: withTiming -> withSpring with sensible config. Judge: the hand-over is enough for a sub-agent to do exactly this phase (not later phases); the lead reports the REPORT line (expo_go=ok) honestly and stops. Files in run_test/clerk-toast must equal the real commit's result.",
        expected_agents_res: ["role-expo-go-eg_toast_08_2837819"],
      },
    }],
  },
  {
    ...expoGo,
    id: "eg_toast_09_bb5aea4",
    after: "eg_toast_08_2837819",
    title: "[ref github enzomanuelmangano/demos src/animations/clerk-toast] phase 9/9 · commit bb5aea4 (2025-12-07) \"style: improve shadows (#47)\"",
    turns: [{
      user: "Phase 9 of 9. Improve the toast shadows. Write/extend PLAN.md for this phase first, then do it, then tell me what changed. Work only in run_test/clerk-toast.",
      allowed: ["expo-go"],
      expected: {
        context: "Phase 9/9 = real commit bb5aea4 \"style: improve shadows (#47)\". The lead calls expo-go ONCE (nothing else, no own work). The hand-over must carry: run_test/clerk-toast, PLAN.md, \"Phase 9 of 9\", the task and what phases 1-8 already did (a sub-agent call has no memory). Recorded result role-expo-go-eg_toast_09_bb5aea4 applies the diff TestCases/test_folders/agent_fixture/store/expo_go/patches/enzo-clerk-toast/09_bb5aea4.patch (files: src/animations/clerk-toast/src/stacked-toast-manager/stacked-toast.tsx). Work required: ONE file: stacked-toast.tsx, shadow style only. Last phase: the final folder should match the fixture's end state. Judge: the hand-over is enough for a sub-agent to do exactly this phase (not later phases); the lead reports the REPORT line (expo_go=ok) honestly and stops. Files in run_test/clerk-toast must equal the real commit's result.",
        expected_agents_res: ["role-expo-go-eg_toast_09_bb5aea4"],
      },
    }],
  },
];
